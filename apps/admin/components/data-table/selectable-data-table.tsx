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
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Column } from './data-table';

/**
 * Props for SelectableDataTable component
 * @template T - The type of data in each row
 */
export interface SelectableDataTableProps<T> {
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
  /**
   * Currently selected item IDs
   */
  selectedIds: string[];
  /**
   * Callback when selection changes
   */
  onSelectionChange: (ids: string[]) => void;
}

/**
 * Selectable Data Table Component
 *
 * A data table with checkbox selection support for bulk operations.
 *
 * @example
 * ```tsx
 * const [selectedIds, setSelectedIds] = useState<string[]>([]);
 *
 * <SelectableDataTable
 *   data={products}
 *   columns={columns}
 *   keyExtractor={(p) => p.id}
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 *   onRowClick={(p) => router.push(`/products/${p.id}`)}
 * />
 * ```
 */
export function SelectableDataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyState,
  className,
  selectedIds,
  onSelectionChange,
}: SelectableDataTableProps<T>) {
  // Get all IDs from data
  const allIds = React.useMemo(() => data.map(keyExtractor), [data, keyExtractor]);

  // Check if all items are selected
  const allSelected = data.length > 0 && allIds.every((id) => selectedIds.includes(id));

  // Check if some (but not all) items are selected
  const someSelected = selectedIds.length > 0 && !allSelected;

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all items
      onSelectionChange([...new Set([...selectedIds, ...allIds])]);
    } else {
      // Deselect all items on current page
      onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
    }
  };

  // Handle individual row selection
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

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
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    // Set indeterminate state for partial selection
                    (el as unknown as { indeterminate: boolean }).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
                aria-label="Select all rows"
              />
            </TableHead>
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
            const isSelected = selectedIds.includes(key);

            return (
              <TableRow
                key={key}
                className={cn(
                  onRowClick ? 'cursor-pointer' : undefined,
                  isSelected && 'bg-muted/50'
                )}
                onClick={() => onRowClick?.(item)}
                data-selected={isSelected}
              >
                <TableCell className="w-12">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectRow(key, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select row ${key}`}
                  />
                </TableCell>
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
