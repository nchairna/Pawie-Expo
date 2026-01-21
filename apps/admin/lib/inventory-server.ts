/**
 * Server-side inventory data access functions
 * For use in Server Components and Server Actions only
 */

import { createClient } from './supabase-server';
import type { InventoryWithProduct, InventoryMovement, PaginatedResponse } from './types';

export interface GetInventoryOptions {
  page?: number;
  limit?: number;
  search?: string;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
}

/**
 * Get all inventory with product info using RPC function
 * Returns paginated response with inventory and metadata
 */
export async function getInventory(
  options?: GetInventoryOptions
): Promise<PaginatedResponse<InventoryWithProduct>> {
  const supabase = await createClient();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;

  // Call the paginated RPC function
  const { data, error } = await supabase.rpc('get_all_products_with_inventory', {
    p_limit: limit,
    p_offset: offset,
    p_search: options?.search || null,
    p_low_stock_only: options?.lowStockOnly || false,
    p_out_of_stock_only: options?.outOfStockOnly || false,
  });

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  // Get total count for pagination
  const { data: countData, error: countError } = await supabase.rpc(
    'get_products_inventory_count',
    {
      p_search: options?.search || null,
      p_low_stock_only: options?.lowStockOnly || false,
      p_out_of_stock_only: options?.outOfStockOnly || false,
    }
  );

  if (countError) {
    throw new Error(`Failed to get inventory count: ${countError.message}`);
  }

  const total = countData || 0;

  // Transform RPC result to InventoryWithProduct format
  const inventoryData: InventoryWithProduct[] = (data || []).map((row: any) => ({
    id: row.id,
    product_id: row.product_id,
    stock_quantity: row.stock_quantity || 0,
    updated_at: row.updated_at,
    product: {
      id: row.product_id,
      name: row.name,
      sku: row.sku,
      base_price_idr: row.base_price_idr,
      published: row.published,
      primary_image_path: row.primary_image_path,
      // Other product fields not returned by RPC but required by type
      family_id: null,
      detail_template_id: null,
      description: null,
      category: null,
      autoship_eligible: false,
      created_at: '',
      updated_at: row.updated_at || '',
    },
  }));

  return {
    data: inventoryData,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    limit,
  };
}

/**
 * Get inventory movements for a product (server-side)
 */
export async function getInventoryMovements(
  productId: string,
  options?: {
    page?: number;
    limit?: number;
  }
): Promise<PaginatedResponse<InventoryMovement>> {
  const supabase = await createClient();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('inventory_movements')
    .select('*', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch inventory movements: ${error.message}`);
  }

  return {
    data: data || [],
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
    currentPage: page,
    limit,
  };
}

/**
 * Get low stock products (for dashboard alerts)
 * Returns data in simplified format for dashboard widget
 * Falls back to direct query if RPC is not available
 */
export async function getLowStockProducts(
  limit: number = 5
): Promise<{
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: 'out_of_stock' | 'low_stock' | 'in_stock';
}[]> {
  const supabase = await createClient();

  // Try RPC first
  const { data, error } = await supabase.rpc('get_all_products_with_inventory', {
    p_limit: limit,
    p_offset: 0,
    p_search: null,
    p_low_stock_only: true,
    p_out_of_stock_only: false,
  });

  // If RPC works, use it
  if (!error && data) {
    return (data || []).map((row: any) => {
      const stockQty = row.stock_quantity || 0;
      const status: 'out_of_stock' | 'low_stock' | 'in_stock' =
        stockQty === 0 ? 'out_of_stock' : stockQty <= 10 ? 'low_stock' : 'in_stock';
      return {
        id: row.product_id,
        name: row.name,
        sku: row.sku || '',
        stock_quantity: stockQty,
        low_stock_threshold: row.low_stock_threshold || 10,
        status,
      };
    });
  }

  // Fallback: direct query with hardcoded threshold
  console.log('RPC not available for low stock, using fallback query');
  const LOW_STOCK_THRESHOLD = 10;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('inventory')
    .select(`
      id,
      product_id,
      stock_quantity,
      product:products (
        id,
        name,
        sku
      )
    `)
    .lte('stock_quantity', LOW_STOCK_THRESHOLD)
    .order('stock_quantity', { ascending: true })
    .limit(limit);

  if (fallbackError) {
    console.error('Fallback query also failed:', fallbackError.message);
    return [];
  }

  return (fallbackData || []).map((row: any) => {
    const stockQty = row.stock_quantity || 0;
    const status: 'out_of_stock' | 'low_stock' | 'in_stock' =
      stockQty === 0 ? 'out_of_stock' : 'low_stock';
    return {
      id: row.product_id,
      name: row.product?.name || 'Unknown Product',
      sku: row.product?.sku || '',
      stock_quantity: stockQty,
      low_stock_threshold: LOW_STOCK_THRESHOLD,
      status,
    };
  });
}

/**
 * Get out of stock products count (for dashboard)
 */
export async function getOutOfStockCount(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_products_inventory_count', {
    p_search: null,
    p_low_stock_only: false,
    p_out_of_stock_only: true,
  });

  if (error) {
    throw new Error(`Failed to get out of stock count: ${error.message}`);
  }

  return data || 0;
}

/**
 * Get low stock products count (for dashboard)
 */
export async function getLowStockCount(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_products_inventory_count', {
    p_search: null,
    p_low_stock_only: true,
    p_out_of_stock_only: false,
  });

  if (error) {
    throw new Error(`Failed to get low stock count: ${error.message}`);
  }

  return data || 0;
}

/**
 * Get inventory statistics (for dashboard)
 */
export async function getInventoryStats(): Promise<{
  outOfStockCount: number;
  lowStockCount: number;
  totalProducts: number;
}> {
  const supabase = await createClient();

  // Get all counts in parallel
  const [outOfStockResult, lowStockResult, totalProductsResult] =
    await Promise.all([
      supabase.rpc('get_products_inventory_count', {
        p_search: null,
        p_low_stock_only: false,
        p_out_of_stock_only: true,
      }),
      supabase.rpc('get_products_inventory_count', {
        p_search: null,
        p_low_stock_only: true,
        p_out_of_stock_only: false,
      }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
    ]);

  if (outOfStockResult.error) {
    throw new Error(
      `Failed to get out of stock count: ${outOfStockResult.error.message}`
    );
  }

  if (lowStockResult.error) {
    throw new Error(
      `Failed to get low stock count: ${lowStockResult.error.message}`
    );
  }

  if (totalProductsResult.error) {
    throw new Error(
      `Failed to get total products: ${totalProductsResult.error.message}`
    );
  }

  return {
    outOfStockCount: outOfStockResult.data || 0,
    lowStockCount: lowStockResult.data || 0,
    totalProducts: totalProductsResult.count || 0,
  };
}
