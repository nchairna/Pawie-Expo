/**
 * Inventory data access functions for admin
 */

import { supabase } from './supabase';
import type { Inventory, InventoryMovement, InventoryWithProduct, Product } from './types';

/**
 * Get all inventory with product info
 * Returns ALL products, including those without inventory records
 */
export async function getAllInventory(options?: {
  limit?: number;
  offset?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  search?: string;
}): Promise<InventoryWithProduct[]> {
  const { data, error } = await supabase.rpc('get_all_products_with_inventory', {
    p_low_stock: options?.lowStock || false,
    p_out_of_stock: options?.outOfStock || false,
    p_search: options?.search || null,
    p_limit: options?.limit || null,
    p_offset: options?.offset || 0,
  });

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  // Parse JSONB result - data is already an array of InventoryWithProduct
  return (data || []) as InventoryWithProduct[];
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

  if (!data || data.success === false) {
    throw new Error(data?.message || data?.error || 'Failed to adjust inventory');
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
