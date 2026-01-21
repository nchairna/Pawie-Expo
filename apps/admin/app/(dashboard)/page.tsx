import { Suspense } from 'react';
import { StatsCardsAsync } from '@/components/dashboard/stats-cards-async';
import { RecentOrdersAsync } from '@/components/dashboard/recent-orders-async';
import { LowStockAlertsAsync } from '@/components/dashboard/low-stock-alerts-async';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { StatsSkeleton } from '@/components/ui/stats-skeleton';
import { RecentOrdersSkeleton } from '@/components/ui/recent-orders-skeleton';
import { LowStockSkeleton } from '@/components/ui/low-stock-skeleton';

// Real-time data - no cache
export const revalidate = 0;

/**
 * Admin Dashboard - Core Stats & Quick Actions
 *
 * Server Component with Suspense boundaries for streaming.
 * Each section fetches its own data independently for optimal performance.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your store operations and key metrics
        </p>
      </div>

      {/* Stats Cards - Suspense Boundary 1 */}
      <Suspense fallback={<StatsSkeleton count={4} />}>
        <StatsCardsAsync />
      </Suspense>

      {/* Quick Actions - Static, no Suspense needed */}
      <QuickActions />

      {/* Recent Activity - Two Columns - Suspense Boundaries 2 & 3 */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Recent Orders */}
        <Suspense fallback={<RecentOrdersSkeleton rows={10} />}>
          <RecentOrdersAsync />
        </Suspense>

        {/* Low Stock Alerts */}
        <Suspense fallback={<LowStockSkeleton rows={5} />}>
          <LowStockAlertsAsync />
        </Suspense>
      </div>
    </div>
  );
}
