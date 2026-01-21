'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X, Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface ProductTag {
  id: string;
  name: string;
}

export function ProductsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const publishedFilter = searchParams.get('published');
  const selectedTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];

  const [tags, setTags] = useState<ProductTag[]>([]);
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // Load tags from database
  useEffect(() => {
    const loadTags = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('product_tags')
        .select('id, name')
        .order('name');
      if (data) setTags(data);
    };
    loadTags();
  }, []);

  // Count active filters
  const activeFilterCount = [
    publishedFilter !== null,
    selectedTags.length > 0,
  ].filter(Boolean).length;

  const handlePublishedChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete('published');
    } else {
      params.set('published', value);
    }
    params.set('page', '1');

    router.push(`/products?${params.toString()}`);
  };

  const handleTagToggle = (tagId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTags = params.get('tags')?.split(',').filter(Boolean) || [];

    let newTags: string[];
    if (currentTags.includes(tagId)) {
      newTags = currentTags.filter(t => t !== tagId);
    } else {
      newTags = [...currentTags, tagId];
    }

    if (newTags.length > 0) {
      params.set('tags', newTags.join(','));
    } else {
      params.delete('tags');
    }
    params.set('page', '1');

    router.push(`/products?${params.toString()}`);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('published');
    params.delete('tags');
    params.set('page', '1');
    router.push(`/products?${params.toString()}`);
  };

  const handleClearTags = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tags');
    params.set('page', '1');
    router.push(`/products?${params.toString()}`);
    setIsTagsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Published Status Filter */}
      <Select
        value={publishedFilter || 'all'}
        onValueChange={handlePublishedChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Products</SelectItem>
          <SelectItem value="true">Published</SelectItem>
          <SelectItem value="false">Unpublished</SelectItem>
        </SelectContent>
      </Select>

      {/* Tags Filter Popover */}
      <Popover open={isTagsOpen} onOpenChange={setIsTagsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Tag className="h-4 w-4" />
            Tags
            {selectedTags.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {selectedTags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filter by Tags</span>
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearTags}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-3">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags available
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded-md -mx-2"
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Count & Clear Button */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
