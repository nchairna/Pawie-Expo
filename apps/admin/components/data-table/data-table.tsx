'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Column definition for DataTable
 * @template T - The type of data in each row
 */
export interface Column<T> {
  /**
   * Column header text
   */
  header: string;
  /**
   * Function to extract/render cell content from row data
   */
  accessor: (item: T) => React.ReactNode;
  /**
   * Optional className for the table cell
   */
  className?: string;
  /**
   * Optional className for the table header cell
   */
  headerClassName?: string;
}

/**
 * Props for DataTable component
 * @template T - The type of data in each row
 */
export interface DataTableProps<T> {
  /**
   * Array of data to display in the table
   */
  data: T[];
  /**
   * Column definitions
   */
  columns: Column<T>[];
  /**
   * Function to extract a unique key from each row
   */
  keyExtractor: (item: T) => string;
  /**
   * Optional row click handler
   */
  onRowClick?: (item: T) => void;
  /**
   * Empty state configuration
   */
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
      label: string;
      href?: string;
      onClick?: () => void;
    };
  };
  /**
   * Optional className for the table container
   */
  className?: string;
}

/**
 * Generic Data Table Component
 *
 * A reusable, type-safe table component for displaying data with custom columns.
 * Supports row click handlers, custom cell rendering, and empty states.
 *
 * @example
 * ```tsx
 * interface Product {
 *   id: string;
 *   name: string;
 *   price: number;
 * }
 *
 * const columns: Column<Product>[] = [
 *   {
 *     header: 'Name',
 *     accessor: (product) => product.name,
 *   },
 *   {
 *     header: 'Price',
 *     accessor: (product) => `$${product.price}`,
 *     className: 'text-right',
 *   },
 * ];
 *
 * <DataTable
 *   data={products}
 *   columns={columns}
 *   keyExtractor={(product) => product.id}
 *   onRowClick={(product) => router.push(`/products/${product.id}`)}
 *   emptyState={{
 *     icon: Package,
 *     title: 'No products',
 *     description: 'Get started by creating your first product',
 *     action: { label: 'New Product', href: '/products/new' }
 *   }}
 * />
 * ```
 */
export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyState,
  className,
}: DataTableProps<T>) {
  // Show empty state if no data and emptyState config provided
  if (data.length === 0 && emptyState) {
    return (
      <div className={cn('border rounded-lg', className)}>
        <EmptyState {...emptyState} />
      </div>
    );
  }

  // Show minimal empty state if no data and no emptyState config
  if (data.length === 0) {
    return (
      <div className={cn('border rounded-lg p-12 text-center', className)}>
        <p className="text-muted-foreground">No data available.</p>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                key={index}
                className={column.headerClassName}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const key = keyExtractor(item);
            return (
              <TableRow
                key={key}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, index) => (
                  <TableCell
                    key={index}
                    className={column.className}
                  >
                    {column.accessor(item)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
