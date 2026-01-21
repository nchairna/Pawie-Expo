import { Skeleton } from '@/components/ui/skeleton';
import { Package, AlertTriangle, XCircle } from 'lucide-react';

/**
 * Inventory Stats Skeleton - Loading state for inventory summary cards
 *
 * Displays animated skeleton cards matching the structure of inventory stats.
 * Use this while inventory summary data is loading.
 */
export function InventoryStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Products */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>

      {/* In Stock */}
      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
          <Package className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
      </div>

      {/* Low Stock */}
      <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
          <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
      </div>

      {/* Out of Stock */}
      <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
      </div>
    </div>
  );
}
