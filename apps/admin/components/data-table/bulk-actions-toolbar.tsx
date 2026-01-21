'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkAction {
  /**
   * Unique identifier for the action
   */
  id: string;
  /**
   * Display label for the action
   */
  label: string;
  /**
   * Icon to display (lucide-react icon component)
   */
  icon?: React.ReactNode;
  /**
   * Handler function called with selected item IDs
   */
  onClick: (selectedIds: string[]) => Promise<void> | void;
  /**
   * Optional variant for the button
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  /**
   * Whether this action requires confirmation
   */
  requiresConfirmation?: boolean;
  /**
   * Confirmation message
   */
  confirmationMessage?: string;
}

interface BulkActionsToolbarProps {
  /**
   * Array of selected item IDs
   */
  selectedIds: string[];
  /**
   * Callback to clear selection
   */
  onClearSelection: () => void;
  /**
   * Available bulk actions
   */
  actions: BulkAction[];
  /**
   * Optional className for the toolbar
   */
  className?: string;
}

/**
 * Bulk Actions Toolbar
 *
 * Shows when items are selected, displays count and available actions.
 *
 * @example
 * ```tsx
 * <BulkActionsToolbar
 *   selectedIds={selectedIds}
 *   onClearSelection={() => setSelectedIds([])}
 *   actions={[
 *     {
 *       id: 'publish',
 *       label: 'Publish',
 *       icon: <Eye className="h-4 w-4" />,
 *       onClick: async (ids) => { await bulkPublish(ids); },
 *     },
 *     {
 *       id: 'delete',
 *       label: 'Delete',
 *       icon: <Trash2 className="h-4 w-4" />,
 *       variant: 'destructive',
 *       requiresConfirmation: true,
 *       confirmationMessage: 'Are you sure you want to delete these items?',
 *       onClick: async (ids) => { await bulkDelete(ids); },
 *     },
 *   ]}
 * />
 * ```
 */
export function BulkActionsToolbar({
  selectedIds,
  onClearSelection,
  actions,
  className,
}: BulkActionsToolbarProps) {
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  if (selectedIds.length === 0) {
    return null;
  }

  const handleAction = async (action: BulkAction) => {
    if (loadingAction) return;

    // Handle confirmation if required
    if (action.requiresConfirmation) {
      const message = action.confirmationMessage ||
        `Are you sure you want to ${action.label.toLowerCase()} ${selectedIds.length} item(s)?`;
      if (!confirm(message)) {
        return;
      }
    }

    try {
      setLoadingAction(action.id);
      await action.onClick(selectedIds);
      // Clear selection after successful action
      onClearSelection();
    } catch (error) {
      console.error(`Error executing ${action.id}:`, error);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3 mb-4',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={() => handleAction(action)}
            disabled={loadingAction !== null}
          >
            {loadingAction === action.id ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : action.icon ? (
              <span className="mr-2">{action.icon}</span>
            ) : null}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
