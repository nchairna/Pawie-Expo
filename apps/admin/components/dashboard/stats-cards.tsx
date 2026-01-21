import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardStats } from '@/lib/types';

interface StatsCardsProps {
  stats: DashboardStats;
}

/**
 * Formats Indonesian Rupiah currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Orders Today/Week/Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold">{stats.orders.today}</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <div className="font-semibold">{stats.orders.thisWeek}</div>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
              <div>
                <div className="font-semibold">{stats.orders.thisMonth}</div>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.revenue.today)}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="font-semibold">
                  {formatNumber(stats.revenue.thisWeek)}
                </div>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
              <div>
                <div className="font-semibold">
                  {formatNumber(stats.revenue.thisMonth)}
                </div>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders by Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending</span>
              <Badge variant="secondary">{stats.orders.pending}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paid</span>
              <Badge variant="default">{stats.orders.paid}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Processing</span>
              <Badge variant="default">{stats.orders.processing}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shipped</span>
              <Badge variant="default">{stats.orders.shipped}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory & Autoships */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Inventory & Autoships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Inventory Alerts</p>
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {stats.inventory.outOfStock}
                  </div>
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-600">
                    {stats.inventory.lowStock}
                  </div>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Autoships</p>
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-lg font-bold">{stats.autoships.active}</div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {stats.autoships.dueToday}
                  </div>
                  <p className="text-xs text-muted-foreground">Due Today</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
