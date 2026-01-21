import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth-server';
import { getOrders } from '@/lib/orders-server';
import { OrdersTable } from '@/components/orders/orders-table';
import { OrdersFilters } from './orders-filters';
import { DataTablePagination } from '@/components/data-table';
import { TableSkeleton } from '@/components/ui/table-skeleton';

// Dynamic data - 1 minute cache
export const revalidate = 60;

interface OrdersPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    source?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

interface OrdersContentProps {
  searchParams: {
    page?: string;
    status?: string;
    source?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Async Orders Content - Fetches and displays orders table with pagination
 */
async function OrdersContent({ searchParams }: OrdersContentProps) {
  // Parse search params
  const page = parseInt(searchParams.page || '1');
  const status = searchParams.status || 'all';
  const source = (searchParams.source as 'one_time' | 'autoship' | 'all') || 'all';
  const search = searchParams.search || undefined;
  const startDate = searchParams.startDate || undefined;
  const endDate = searchParams.endDate || undefined;

  // Fetch orders (server-side)
  const { data: orders, total, pages, currentPage } = await getOrders({
    page,
    status,
    source,
    search,
    startDate,
    endDate,
  });

  return (
    <>
      <OrdersTable orders={orders} />
      <DataTablePagination
        currentPage={currentPage}
        totalPages={pages}
        total={total}
      />
    </>
  );
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  // Require admin authentication
  await requireAdmin();

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = await searchParams;

  // Extract filter params for OrdersFilters
  const status = resolvedSearchParams.status || 'all';
  const source = resolvedSearchParams.source || 'all';
  const search = resolvedSearchParams.search || undefined;
  const startDate = resolvedSearchParams.startDate || undefined;
  const endDate = resolvedSearchParams.endDate || undefined;

  return (
    <div className="container mx-auto p-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">
              Manage and track customer orders
            </p>
          </div>
        </div>

        {/* Filters - Client Component for interactivity */}
        <OrdersFilters
          initialStatus={status}
          initialSource={source}
          initialSearch={search}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />

        {/* Orders Table with Suspense */}
        <Suspense
          key={JSON.stringify(resolvedSearchParams)}
          fallback={<TableSkeleton columnCount={6} rowCount={20} showActions />}
        >
          <OrdersContent searchParams={resolvedSearchParams} />
        </Suspense>
      </div>
    </div>
  );
}
