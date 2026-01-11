/**
 * Inventory data access functions for admin
 */

import { supabase } from './supabase';
import type { Inventory, InventoryMovement, InventoryWithProduct, Product } from './types';

/**
 * Get all inventory with product info
 */
export async function getAllInventory(options?: {
  limit?: number;
  offset?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  search?: string;
}): Promise<InventoryWithProduct[]> {
  let query = supabase
    .from('inventory')
    .select(`
      *,
      product:products (
        id,
        name,
        primary_image_path,
        sku,
        published
      )
    `)
    .order('updated_at', { ascending: false });

  // Filter by stock status
  if (options?.outOfStock) {
    query = query.eq('stock_quantity', 0);
  } else if (options?.lowStock) {
    query = query.gt('stock_quantity', 0).lte('stock_quantity', 10);
  }

  // Note: Search filtering will be done client-side due to Supabase nested query limitations

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    ...item,
    product: item.product || undefined,
  }));
}

/**
 * Get inventory for a specific product
 */
export async function getInventoryByProductId(
  productId: string
): Promise<Inventory | null> {

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', productId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  return data;
}

/**
 * Adjust inventory using database function
 */
export async function adjustInventory(
  productId: string,
  adjustment: number,
  reason: string
): Promise<Inventory> {

  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_product_id: productId,
    p_adjustment: adjustment,
    p_reason: reason,
  });

  if (error) {
    throw new Error(`Failed to adjust inventory: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Failed to adjust inventory');
  }

  // Fetch updated inventory
  const updatedInventory = await getInventoryByProductId(productId);
  if (!updatedInventory) {
    // If inventory record doesn't exist, create it
    const { data: newInventory, error: createError } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        stock_quantity: adjustment > 0 ? adjustment : 0,
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create inventory record: ${createError.message}`);
    }

    return newInventory;
  }

  return updatedInventory;
}

/**
 * Get inventory movements for a product
 */
export async function getInventoryMovements(
  productId: string,
  options?: { limit?: number; offset?: number }
): Promise<InventoryMovement[]> {
  let query = supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch inventory movements: ${error.message}`);
  }

  return data || [];
}
