/**
 * Server-side data access functions for the admin dashboard
 * Uses RPC function get_dashboard_stats for optimized metrics fetching
 * Falls back to individual queries if RPC is not available
 */

import { createClient } from './supabase-server';
import { DashboardStats } from './types';

/**
 * Returns default empty stats
 */
function getEmptyStats(): DashboardStats {
  return {
    orders: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      pending: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
    },
    revenue: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
    },
    inventory: {
      outOfStock: 0,
      lowStock: 0,
      totalProducts: 0,
    },
    autoships: {
      active: 0,
      dueToday: 0,
    },
  };
}

/**
 * Fetches dashboard statistics using individual queries as fallback
 */
async function getDashboardStatsFallback(): Promise<DashboardStats> {
  const supabase = await createClient();
  const stats = getEmptyStats();

  try {
    // Get order counts
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

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

    stats.orders.thisMonth = totalOrders || 0;
    stats.orders.pending = pendingOrders || 0;
    stats.orders.paid = paidOrders || 0;
    stats.orders.processing = processingOrders || 0;
    stats.orders.shipped = shippedOrders || 0;

    // Get inventory stats with hardcoded threshold
    const LOW_STOCK_THRESHOLD = 10;

    const { count: outOfStock } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('stock_quantity', 0);

    const { count: lowStock } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .gt('stock_quantity', 0)
      .lte('stock_quantity', LOW_STOCK_THRESHOLD);

    stats.inventory.outOfStock = outOfStock || 0;
    stats.inventory.lowStock = lowStock || 0;

    // Get autoship stats
    const { count: activeAutoships } = await supabase
      .from('autoships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    stats.autoships.active = activeAutoships || 0;

  } catch (err) {
    console.error('Error in fallback stats:', err);
  }

  return stats;
}

/**
 * Fetches dashboard statistics using the get_dashboard_stats RPC function
 * This function is optimized to run multiple aggregations in a single database call
 * Falls back to individual queries if RPC is not available
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  // Call the RPC function that returns all stats in one query
  const { data, error } = await supabase.rpc('get_dashboard_stats');

  if (error) {
    // Log the full error for debugging - stringify to see all properties
    console.error('Error fetching dashboard stats via RPC:', JSON.stringify(error, null, 2));
    console.error('Error type:', typeof error);
    console.error('Error keys:', Object.keys(error));

    // Always fall back to individual queries on any error
    console.log('Using fallback queries due to RPC error...');
    return getDashboardStatsFallback();
  }

  if (!data) {
    console.log('No data returned from RPC, using fallback');
    return getDashboardStatsFallback();
  }

  // Transform the RPC response to match our DashboardStats type
  return {
    orders: {
      today: data.orders_today || 0,
      thisWeek: data.orders_this_week || 0,
      thisMonth: data.orders_this_month || 0,
      pending: data.pending_orders || 0,
      paid: data.paid_orders || 0,
      processing: data.processing_orders || 0,
      shipped: data.shipped_orders || 0,
    },
    revenue: {
      today: data.revenue_today || 0,
      thisWeek: data.revenue_this_week || 0,
      thisMonth: data.revenue_this_month || 0,
    },
    inventory: {
      outOfStock: data.out_of_stock_count || 0,
      lowStock: data.low_stock_count || 0,
      totalProducts: 0,
    },
    autoships: {
      active: data.active_autoships || 0,
      dueToday: data.autoships_due_today || 0,
    },
  };
}
