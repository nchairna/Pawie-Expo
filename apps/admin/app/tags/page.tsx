'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTags, deleteTag } from '@/lib/tags';
import type { ProductTag } from '@/lib/types';
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
import { Plus, MoreHorizontal, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTags();
        setTags(data);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load tags';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchTags();
  }, []);

  // Filter tags
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    tag.slug.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const handleDelete = async (tag: ProductTag) => {
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"?`)) {
      return;
    }

    try {
      setDeletingTagId(tag.id);
      await deleteTag(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      toast.success('Tag deleted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tag');
    } finally {
      setDeletingTagId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading tags...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && tags.length === 0) {
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
          <h1 className="text-3xl font-bold mb-2">Product Tags</h1>
          <p className="text-muted-foreground">
            Manage product tags for multi-category support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/products')}
          >
            Products
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/families')}
          >
            Families
          </Button>
          <Button onClick={() => router.push('/tags/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Tag
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tags Table */}
      {filteredTags.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            {tags.length === 0
              ? 'No tags yet. Create your first tag.'
              : 'No tags match your search.'}
          </p>
          {tags.length === 0 && (
            <Button onClick={() => router.push('/tags/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Tag
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {tag.slug}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/tags/${tag.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(tag)}
                          disabled={deletingTagId === tag.id}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deletingTagId === tag.id ? 'Deleting...' : 'Delete'}
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

