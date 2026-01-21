'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, togglePublish, deleteProduct } from '@/lib/products';
import { getImageUrl } from '@/lib/images';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { MoreHorizontal, Plus, Search, Loader2, Edit, Trash2 } from 'lucide-react';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts();
        setProducts(data);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load products';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return products;
    }

    const query = debouncedSearch.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        (product.category && product.category.toLowerCase().includes(query))
    );
  }, [products, debouncedSearch]);

  const handleTogglePublish = async (product: Product) => {
    if (togglingIds.has(product.id)) return;

    try {
      setTogglingIds((prev) => new Set(prev).add(product.id));
      await togglePublish(product.id, !product.published);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, published: !p.published } : p
        )
      );
      toast.success(
        `Product ${!product.published ? 'published' : 'unpublished'} successfully`
      );
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

  const handleDelete = async (product: Product) => {
    if (deletingIds.has(product.id)) return;

    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      setDeletingIds((prev) => new Set(prev).add(product.id));
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Product deleted successfully');
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

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

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
          <Button
            variant="outline"
            onClick={() => router.push('/families')}
          >
            Families
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/tags')}
          >
            Tags
          </Button>
          <Button onClick={() => router.push('/products/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Product
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            {products.length === 0
              ? 'No products yet. Create your first product.'
              : 'No products match your search.'}
          </p>
          {products.length === 0 && (
            <Button onClick={() => router.push('/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
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
                    {product.category || '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={product.published ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePublish(product);
                      }}
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
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product);
                          }}
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
      )}
    </div>
  );
}
