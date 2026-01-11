/**
 * Order data access functions for admin
 */

import { supabase } from './supabase';
import type { Order, OrderWithItems, Profile } from './types';

/**
 * Get all orders with optional filters
 */
export async function getAllOrders(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  source?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select(`
      *,
      user:profiles!orders_user_id_fkey (
        id,
        email,
        full_name,
        role
      ),
      address:addresses!orders_shipping_address_id_fkey (
        id,
        label,
        address_line,
        city,
        province,
        postal_code
      )
    `)
    .order('created_at', { ascending: false });

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  if (options?.source && options.source !== 'all') {
    query = query.eq('source', options.source);
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  if (options?.search) {
    const searchTerm = options.search.toLowerCase();
    // Search by order ID (partial match)
    query = query.ilike('id', `%${searchTerm}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data || []).map((order: any) => ({
    ...order,
    user: order.user ? {
      id: order.user.id,
      email: order.user.email,
      full_name: order.user.full_name,
      role: order.user.role,
    } : undefined,
    address: order.address || undefined,
  }));
}

/**
 * Get order by ID with items
 */
export async function getOrderById(id: string): Promise<OrderWithItems | null> {

  // Get order with user and address
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      user:profiles!orders_user_id_fkey (
        id,
        email,
        full_name,
        role
      ),
      address:addresses!orders_shipping_address_id_fkey (
        id,
        label,
        address_line,
        city,
        province,
        postal_code
      )
    `)
    .eq('id', id)
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
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  const order: any = orderData;
  const items = (itemsData || []).map((item: any) => {
    // Handle discount_breakdown - it's JSONB, could be array or object
    let discountBreakdown = [];
    if (item.discount_breakdown) {
      if (Array.isArray(item.discount_breakdown)) {
        discountBreakdown = item.discount_breakdown;
      } else if (typeof item.discount_breakdown === 'object') {
        // If it's an object, try to convert to array
        discountBreakdown = Object.keys(item.discount_breakdown).length > 0 
          ? [item.discount_breakdown] 
          : [];
      }
    }
    
    return {
      ...item,
      product: item.product || undefined,
      discount_breakdown: discountBreakdown,
    };
  });

  return {
    ...order,
    user: order.user ? {
      id: order.user.id,
      email: order.user.email,
      full_name: order.user.full_name,
      role: order.user.role,
    } : undefined,
    address: order.address || undefined,
    items,
  };
}

/**
 * Update order status using database function
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string
): Promise<Order> {

  const { data, error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
  });

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Failed to update order status');
  }

  // Fetch updated order
  const updatedOrder = await getOrderById(orderId);
  if (!updatedOrder) {
    throw new Error('Order not found after update');
  }

  return updatedOrder;
}

/**
 * Get order statistics
 */
export async function getOrderStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  totalRevenue: number;
}> {

  // Get total orders
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  // Get pending orders
  const { count: pendingOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Get paid orders
  const { count: paidOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'paid');

  // Get total revenue (sum of total_idr for paid, processing, shipped, delivered orders)
  const { data: revenueData } = await supabase
    .from('orders')
    .select('total_idr')
    .in('status', ['paid', 'processing', 'shipped', 'delivered']);

  const totalRevenue = (revenueData || []).reduce((sum, order) => sum + (order.total_idr || 0), 0);

  return {
    totalOrders: totalOrders || 0,
    pendingOrders: pendingOrders || 0,
    paidOrders: paidOrders || 0,
    totalRevenue,
  };
}
