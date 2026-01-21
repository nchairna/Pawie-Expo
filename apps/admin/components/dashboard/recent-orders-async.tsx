import { getRecentOrders } from '@/lib/orders-server';
import { RecentOrders } from './recent-orders';
import type { Order } from '@/lib/types';

/**
 * Async Recent Orders - Fetches and displays recent orders
 *
 * Server Component that fetches its own data.
 * Wrap with Suspense for streaming.
 */
export async function RecentOrdersAsync() {
  let orders: Order[] = [];

  try {
    orders = await getRecentOrders(10);
  } catch (error) {
    console.error('Failed to fetch recent orders:', error);
    // Return empty orders on error
  }

  return <RecentOrders orders={orders} />;
}
