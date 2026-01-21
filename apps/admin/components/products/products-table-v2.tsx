'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { SelectableDataTable, Column, BulkActionsToolbar, BulkAction } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Edit, Trash2, Loader2, Package, Eye, EyeOff } from 'lucide-react';
import {
  togglePublishProduct,
  deleteProduct as deleteProductAction,
  bulkPublishProducts,
  bulkUnpublishProducts,
  bulkDeleteProducts,
} from '@/app/(dashboard)/products/actions';

interface ProductsTableProps {
  products: Product[];
}

export function ProductsTableV2({ products }: ProductsTableProps) {
  const router = useRouter();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk action handlers
  const handleBulkPublish = async (ids: string[]) => {
    const result = await bulkPublishProducts(ids);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} product(s) published successfully`);
    router.refresh();
  };

  const handleBulkUnpublish = async (ids: string[]) => {
    const result = await bulkUnpublishProducts(ids);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} product(s) unpublished successfully`);
    router.refresh();
  };

  const handleBulkDelete = async (ids: string[]) => {
    const result = await bulkDeleteProducts(ids);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} product(s) deleted successfully`);
    router.refresh();
  };

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    {
      id: 'publish',
      label: 'Publish',
      icon: <Eye className="h-4 w-4" />,
      onClick: handleBulkPublish,
    },
    {
      id: 'unpublish',
      label: 'Unpublish',
      icon: <EyeOff className="h-4 w-4" />,
      variant: 'secondary',
      onClick: handleBulkUnpublish,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationMessage: `Are you sure you want to delete ${selectedIds.length} product(s)? This action cannot be undone.`,
      onClick: handleBulkDelete,
    },
  ];

  const handleTogglePublish = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();

    if (togglingIds.has(product.id)) return;

    try {
      setTogglingIds((prev) => new Set(prev).add(product.id));

      // Use Server Action
      const result = await togglePublishProduct(product.id, !product.published);

      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Product ${!product.published ? 'published' : 'unpublished'} successfully`
      );

      // Refresh the page to show updated data
      router.refresh();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle publish status';
      toast.error(errorMessage);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleDelete = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();

    if (deletingIds.has(product.id)) return;

    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      setDeletingIds((prev) => new Set(prev).add(product.id));

      // Use Server Action
      const result = await deleteProductAction(product.id);

      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      toast.success('Product deleted successfully');

      // Refresh the page to show updated data
      router.refresh();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete product';
      toast.error(errorMessage);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Define columns using the Column interface
  const columns: Column<Product>[] = [
    {
      header: 'Name',
      accessor: (product) => <span className="font-medium">{product.name}</span>,
    },
    {
      header: 'SKU',
      accessor: (product) => (
        <span className="text-muted-foreground">{product.sku || '—'}</span>
      ),
    },
    {
      header: 'Category',
      accessor: (product) => (
        <span className="text-muted-foreground">{product.category || '—'}</span>
      ),
    },
    {
      header: 'Published',
      accessor: (product) => (
        <Button
          variant={product.published ? 'default' : 'outline'}
          size="sm"
          onClick={(e) => handleTogglePublish(product, e)}
          disabled={togglingIds.has(product.id)}
        >
          {togglingIds.has(product.id) ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            product.published ? 'Published' : 'Unpublished'
          )}
        </Button>
      ),
    },
    {
      header: 'Updated At',
      accessor: (product) => (
        <span className="text-muted-foreground">{formatDate(product.updated_at)}</span>
      ),
    },
    {
      header: 'Actions',
      accessor: (product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/products/${product.id}`);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => handleDelete(product, e)}
              disabled={deletingIds.has(product.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletingIds.has(product.id) ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      headerClassName: 'text-right',
      className: 'text-right',
    },
  ];

  return (
    <>
      <BulkActionsToolbar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        actions={bulkActions}
      />
      <SelectableDataTable
        data={products}
        columns={columns}
        keyExtractor={(product) => product.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(product) => {
          router.push(`/products/${product.id}`);
        }}
        emptyState={{
          icon: Package,
          title: 'No products found',
          description: 'No products match your current search or filter criteria. Try adjusting your filters or create a new product to get started.',
          action: {
            label: 'Create Product',
            href: '/products/new',
          },
        }}
      />
    </>
  );
}
