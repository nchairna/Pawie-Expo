/**
 * Server-side order data access functions
 * For use in Server Components and Server Actions only
 */

import { createClient } from './supabase-server';
import type { Order, OrderWithItems, PaginatedResponse } from './types';

export interface GetOrdersOptions {
  page?: number;
  limit?: number;
  status?: string;
  source?: 'one_time' | 'autoship' | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get orders with server-side pagination and filtering
 * Returns paginated response with orders and metadata
 */
export async function getOrders(
  options?: GetOrdersOptions
): Promise<PaginatedResponse<Order>> {
  const supabase = await createClient();

  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  // Build query with count and related data
  let query = supabase
    .from('orders')
    .select(
      `
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
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  // Apply filters
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
    // Search by order ID (partial match)
    query = query.ilike('id', `%${options.search}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Transform joined data
  const orders = (data || []).map((order: any) => ({
    ...order,
    user: order.user
      ? {
          id: order.user.id,
          email: order.user.email,
          full_name: order.user.full_name,
          role: order.user.role,
        }
      : undefined,
    address: order.address || undefined,
  }));

  return {
    data: orders,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
    currentPage: page,
    limit,
  };
}

/**
 * Get single order by ID with items (server-side)
 */
export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const supabase = await createClient();

  // Get order with user and address
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(
      `
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
    `
    )
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
    .select(
      `
      *,
      product:products (
        id,
        name,
        primary_image_path,
        sku
      )
    `
    )
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
        discountBreakdown =
          Object.keys(item.discount_breakdown).length > 0
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
    user: order.user
      ? {
          id: order.user.id,
          email: order.user.email,
          full_name: order.user.full_name,
          role: order.user.role,
        }
      : undefined,
    address: order.address || undefined,
    items,
  };
}

/**
 * Get order statistics (server-side)
 * Optimized to use RPC function for single-query stats fetch
 * Falls back to individual queries if RPC is not available
 */
export async function getOrderStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  processingOrders: number;
  shippedOrders: number;
  totalRevenue: number;
}> {
  const supabase = await createClient();

  // Try to use optimized RPC function first
  const { data, error } = await supabase.rpc('get_order_stats');

  if (!error && data) {
    return {
      totalOrders: data.total_orders || 0,
      pendingOrders: data.pending_orders || 0,
      paidOrders: data.paid_orders || 0,
      processingOrders: data.processing_orders || 0,
      shippedOrders: data.shipped_orders || 0,
      totalRevenue: data.total_revenue || 0,
    };
  }

  // Fallback: individual queries (old implementation)
  console.log('RPC get_order_stats not available, using fallback queries');

  // Get total orders
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  // Get orders by status
  const { count: pendingOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: paidOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'paid');

  const { count: processingOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');

  const { count: shippedOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'shipped');

  // Get total revenue (sum of total_idr for paid, processing, shipped, delivered orders)
  const { data: revenueData } = await supabase
    .from('orders')
    .select('total_idr')
    .in('status', ['paid', 'processing', 'shipped', 'delivered']);

  const totalRevenue =
    (revenueData || []).reduce((sum, order) => sum + (order.total_idr || 0), 0);

  return {
    totalOrders: totalOrders || 0,
    pendingOrders: pendingOrders || 0,
    paidOrders: paidOrders || 0,
    processingOrders: processingOrders || 0,
    shippedOrders: shippedOrders || 0,
    totalRevenue,
  };
}

/**
 * Get recent orders (for dashboard)
 * Returns empty array on error instead of throwing
 */
export async function getRecentOrders(limit: number = 10): Promise<Order[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      user:profiles!orders_user_id_fkey (
        id,
        email,
        full_name,
        role
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch recent orders:', error.message);
    return [];
  }

  return (data || []).map((order: any) => ({
    ...order,
    user: order.user
      ? {
          id: order.user.id,
          email: order.user.email,
          full_name: order.user.full_name,
          role: order.user.role,
        }
      : undefined,
  }));
}
