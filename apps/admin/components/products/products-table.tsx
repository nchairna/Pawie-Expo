'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { MoreHorizontal, Edit, Trash2, Loader2, Package } from 'lucide-react';
import { togglePublishProduct, deleteProduct as deleteProductAction } from '@/app/(dashboard)/products/actions';

interface ProductsTableProps {
  products: Product[];
}

export function ProductsTable({ products }: ProductsTableProps) {
  const router = useRouter();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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

  if (products.length === 0) {
    return (
      <div className="border rounded-lg">
        <EmptyState
          icon={Package}
          title="No products found"
          description="No products match your current search or filter criteria. Try adjusting your filters or create a new product to get started."
          action={{
            label: "Create Product",
            href: "/products/new"
          }}
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              className="cursor-pointer"
              onClick={(e) => {
                // Don't navigate if clicking on toggle or actions
                if (
                  (e.target as HTMLElement).closest('button') ||
                  (e.target as HTMLElement).closest('[role="menuitem"]')
                ) {
                  return;
                }
                router.push(`/products/${product.id}`);
              }}
            >
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {product.sku || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {product.category || '—'}
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(product.updated_at)}
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
