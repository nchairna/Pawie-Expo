import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface StatsSkeletonProps {
  /**
   * Number of stat cards to display
   */
  count?: number;
}

/**
 * Stats Skeleton - Loading state for dashboard stat cards
 *
 * Displays animated skeleton cards matching the structure of dashboard stats.
 * Use this while dashboard statistics are loading.
 *
 * @example
 * ```tsx
 * <Suspense fallback={<StatsSkeleton count={4} />}>
 *   <StatsCards stats={stats} />
 * </Suspense>
 * ```
 */
export function StatsSkeleton({ count = 4 }: StatsSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Main stat */}
              <div>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
              {/* Secondary stats */}
              <div className="flex gap-4">
                <div>
                  <Skeleton className="h-5 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div>
                  <Skeleton className="h-5 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
