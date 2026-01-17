/**
 * Order data access functions for mobile app
 * Phase 4: Orders & Checkout
 */

import { supabase } from './supabase';
import type { Order, OrderWithItems, OrderResult } from './types';

/**
 * Get user's orders
 */
export async function getUserOrders(options?: {
  limit?: number;
  offset?: number;
}): Promise<Order[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    throw new Error(`Authentication error: ${authError.message}`);
  }
  
  if (!user) {
    throw new Error('User must be authenticated to view orders');
  }

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, source, subtotal_idr, discount_total_idr, total_idr, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Supabase query error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Return empty array if data is null (no orders yet)
  return data || [];
}

/**
 * Get order by ID (with items)
 */
export async function getOrderById(orderId: string): Promise<OrderWithItems | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to view orders');
  }

  // Get order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id) // Ensure user can only access their own orders
    .single();

  if (orderError) {
    if (orderError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch order: ${orderError.message}`);
  }

  // Get order items with products
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      *,
      product:products (
        id,
        name,
        primary_image_path,
        sku
      )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  // Get address if exists
  let address = null;
  if (orderData.shipping_address_id) {
    const { data: addressData } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', orderData.shipping_address_id)
      .single();
    address = addressData;
  }

  return {
    ...orderData,
    items: (itemsData || []).map((item: any) => ({
      ...item,
      product: item.product || undefined,
    })),
    address: address || undefined,
  };
}

/**
 * Create order using database function
 */
export async function createOrder(
  items: { product_id: string; quantity: number }[],
  addressId: string | null
): Promise<OrderResult> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      error: 'User must be authenticated to create orders',
    };
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'Cart is empty',
    };
  }

  try {
    const itemsJson = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc('create_order_with_inventory', {
      p_user_id: user.id,
      p_items: itemsJson,
      p_address_id: addressId,
      p_source: 'one_time',
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to create order',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Failed to create order',
      };
    }

    return {
      success: true,
      order_id: data.order_id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create order',
    };
  }
}

/**
 * Check if order belongs to current user
 */
export async function isUserOrder(orderId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single();

  return !error && !!data;
}
