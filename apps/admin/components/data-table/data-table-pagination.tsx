'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataTablePaginationProps {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;
  /**
   * Total number of pages
   */
  totalPages: number;
  /**
   * Total number of items (optional, for display purposes)
   */
  total?: number;
  /**
   * Optional base path for pagination links
   * Defaults to current path
   */
  basePath?: string;
}

/**
 * Data Table Pagination Component
 *
 * Provides pagination controls for DataTable using URL searchParams.
 * Preserves existing search params when navigating between pages.
 *
 * @example
 * ```tsx
 * <DataTablePagination
 *   currentPage={2}
 *   totalPages={10}
 *   total={100}
 *   basePath="/products"
 * />
 * ```
 */
export function DataTablePagination({
  currentPage,
  totalPages,
  total,
  basePath,
}: DataTablePaginationProps) {
  const searchParams = useSearchParams();

  // Don't render if only 1 page
  if (totalPages <= 1) {
    return null;
  }

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());

    // Use basePath if provided, otherwise just use query params
    if (basePath) {
      return `${basePath}?${params.toString()}`;
    }
    return `?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        {total ? (
          <>
            Page {currentPage} of {totalPages} ({total.toLocaleString()} total)
          </>
        ) : (
          <>
            Page {currentPage} of {totalPages}
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          asChild={currentPage !== 1}
        >
          {currentPage === 1 ? (
            <span>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </span>
          ) : (
            <Link href={createPageUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          asChild={currentPage !== totalPages}
        >
          {currentPage === totalPages ? (
            <span>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </span>
          ) : (
            <Link href={createPageUrl(currentPage + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}
