import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth-server';
import { getInventory } from '@/lib/inventory-server';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, AlertTriangle, XCircle } from 'lucide-react';
import type { InventoryWithProduct } from '@/lib/types';
import { InventorySearch } from '@/components/inventory/inventory-search';
import { InventoryFilters } from '@/components/inventory/inventory-filters';
import { InventoryClientWrapper } from '@/components/inventory/inventory-client-wrapper';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { InventoryStatsSkeleton } from '@/components/ui/inventory-stats-skeleton';

// Real-time data - no cache
export const revalidate = 0;

const LOW_STOCK_THRESHOLD = 10;

interface InventoryPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    lowStock?: string;
    outOfStock?: string;
    stockFilter?: string;
  }>;
}

interface InventoryStatsProps {
  searchParams: {
    page?: string;
    search?: string;
    lowStock?: string;
    outOfStock?: string;
  };
}

interface InventoryTableContentProps {
  searchParams: {
    page?: string;
    search?: string;
    lowStock?: string;
    outOfStock?: string;
  };
}

/**
 * Async Inventory Stats - Fetches and displays stock summary cards
 */
async function InventoryStatsAsync({ searchParams }: InventoryStatsProps) {
  const page = parseInt(searchParams.page || '1');
  const search = searchParams.search;
  const lowStockOnly = searchParams.lowStock === 'true';
  const outOfStockOnly = searchParams.outOfStock === 'true';

  const { data: inventory, total } = await getInventory({
    page,
    limit: 50,
    search,
    lowStockOnly,
    outOfStockOnly,
  });

  if (inventory.length === 0) {
    return null;
  }

  const stockSummary = {
    inStock: inventory.filter(
      (item) => item.stock_quantity > LOW_STOCK_THRESHOLD
    ).length,
    lowStock: inventory.filter(
      (item) =>
        item.stock_quantity > 0 && item.stock_quantity <= LOW_STOCK_THRESHOLD
    ).length,
    outOfStock: inventory.filter((item) => item.stock_quantity === 0).length,
    total: total,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Products</p>
            <p className="text-2xl font-bold">{stockSummary.total}</p>
          </div>
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">In Stock</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {stockSummary.inStock}
            </p>
          </div>
          <Package className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {stockSummary.lowStock}
            </p>
          </div>
          <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
      </div>
      <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {stockSummary.outOfStock}
            </p>
          </div>
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
      </div>
    </div>
  );
}

/**
 * Async Inventory Table Content - Fetches and displays inventory table
 */
async function InventoryTableContentAsync({ searchParams }: InventoryTableContentProps) {
  const page = parseInt(searchParams.page || '1');
  const search = searchParams.search;
  const lowStockOnly = searchParams.lowStock === 'true';
  const outOfStockOnly = searchParams.outOfStock === 'true';

  const { data: inventory, total, pages, currentPage } = await getInventory({
    page,
    limit: 50,
    search,
    lowStockOnly,
    outOfStockOnly,
  });

  // Empty state
  if (inventory.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        {total === 0 && !search && !lowStockOnly && !outOfStockOnly ? (
          <div className="space-y-4">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">No inventory records found</p>
              <p className="text-muted-foreground mt-2">
                Inventory records are created automatically when products are
                added or orders are placed.
                <br />
                If you have products but no inventory, you can add stock using the
                Adjust button.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              No inventory found matching your filters.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                // Client-side navigation to clear filters
                window.location.href = '/inventory';
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <InventoryClientWrapper inventory={inventory} />
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={pages}
            total={total}
          />
        </div>
      )}
    </>
  );
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  // Require admin authentication
  await requireAdmin();

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = await searchParams;

  return (
    <div className="container mx-auto p-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">
              Track and adjust product inventory levels
            </p>
          </div>
        </div>

        {/* Stock Summary Cards with Suspense */}
        <Suspense
          key={`stats-${JSON.stringify(resolvedSearchParams)}`}
          fallback={<InventoryStatsSkeleton />}
        >
          <InventoryStatsAsync searchParams={resolvedSearchParams} />
        </Suspense>

        {/* Filters - Client Component for interactivity */}
        <div className="flex flex-col sm:flex-row gap-4">
          <InventorySearch />
          <InventoryFilters />
        </div>

        {/* Inventory Table with Suspense */}
        <Suspense
          key={`table-${JSON.stringify(resolvedSearchParams)}`}
          fallback={<TableSkeleton columnCount={6} rowCount={20} showActions />}
        >
          <InventoryTableContentAsync searchParams={resolvedSearchParams} />
        </Suspense>
      </div>
    </div>
  );
}
