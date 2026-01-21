import { getDashboardStats } from '@/lib/dashboard-server';
import { StatsCards } from './stats-cards';
import type { DashboardStats } from '@/lib/types';

// Default empty stats for error cases
const emptyStats: DashboardStats = {
  orders: { today: 0, thisWeek: 0, thisMonth: 0, pending: 0, paid: 0, processing: 0, shipped: 0 },
  revenue: { today: 0, thisWeek: 0, thisMonth: 0 },
  inventory: { outOfStock: 0, lowStock: 0, totalProducts: 0 },
  autoships: { active: 0, dueToday: 0 },
};

/**
 * Async Stats Cards - Fetches and displays dashboard statistics
 *
 * Server Component that fetches its own data.
 * Wrap with Suspense for streaming.
 */
export async function StatsCardsAsync() {
  let stats = emptyStats;

  try {
    stats = await getDashboardStats();
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    // Return empty stats on error
  }

  return <StatsCards stats={stats} />;
}
