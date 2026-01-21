import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface DataTableSkeletonProps {
  /**
   * Number of columns in the table
   */
  columnCount?: number;
  /**
   * Number of rows to display in the skeleton
   */
  rowCount?: number;
  /**
   * Whether to show actions column (usually last column with buttons)
   */
  showActions?: boolean;
}

/**
 * Data Table Skeleton - Loading state for DataTable component
 *
 * Displays an animated skeleton matching the structure of the DataTable.
 * Use this inside a Suspense boundary or while data is loading.
 *
 * @example
 * ```tsx
 * <Suspense fallback={<DataTableSkeleton columnCount={5} rowCount={10} />}>
 *   <ProductsDataTable />
 * </Suspense>
 * ```
 */
export function DataTableSkeleton({
  columnCount = 5,
  rowCount = 10,
  showActions = true,
}: DataTableSkeletonProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
            {showActions && (
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              {showActions && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
