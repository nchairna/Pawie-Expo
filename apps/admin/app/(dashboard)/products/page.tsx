import { Suspense } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth-server';
import { getProducts } from '@/lib/products-server';
import { ProductsSearch } from '@/components/products/products-search';
import { ProductsFilters } from '@/components/products/products-filters';
import { ProductsTableV2 } from '@/components/products/products-table-v2';
import { DataTablePagination, DataTableSkeleton } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Dynamic data - 1 minute cache
export const revalidate = 60;

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    published?: string;
    familyId?: string;
  }>;
}

interface ProductsContentProps {
  searchParams: {
    page?: string;
    search?: string;
    published?: string;
    familyId?: string;
  };
}

async function ProductsContent({ searchParams }: ProductsContentProps) {
  // Parse search params
  const page = parseInt(searchParams.page || '1', 10);
  const search = searchParams.search;
  const publishedParam = searchParams.published;
  const familyId = searchParams.familyId;

  // Convert published param to boolean if present
  const published = publishedParam === 'true' ? true : publishedParam === 'false' ? false : undefined;

  // Fetch products with server-side filtering
  const result = await getProducts({
    page,
    limit: 50,
    search,
    published,
    familyId,
  });

  return (
    <>
      <ProductsTableV2 products={result.data} />
      <DataTablePagination
        currentPage={result.currentPage}
        totalPages={result.pages}
        total={result.total}
      />
    </>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Require admin authentication
  await requireAdmin();

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = await searchParams;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/families">Families</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tags">Tags</Link>
          </Button>
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <ProductsSearch />
        <ProductsFilters />
      </div>

      {/* Products Table with Suspense */}
      <Suspense key={JSON.stringify(resolvedSearchParams)} fallback={<DataTableSkeleton columnCount={5} rowCount={10} showActions />}>
        <ProductsContent searchParams={resolvedSearchParams} />
      </Suspense>
    </div>
  );
}
