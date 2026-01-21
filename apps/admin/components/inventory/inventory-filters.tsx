'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

export function InventoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stockFilter = searchParams.get('stockFilter') || 'all';
  const search = searchParams.get('search') || '';

  // Count active filters
  const activeFilterCount = [
    stockFilter !== 'all',
    search.length > 0,
  ].filter(Boolean).length;

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('lowStock');
      params.delete('outOfStock');
      params.delete('stockFilter');
    } else {
      params.set('stockFilter', value);
      if (value === 'low') {
        params.set('lowStock', 'true');
        params.delete('outOfStock');
      } else if (value === 'out') {
        params.set('outOfStock', 'true');
        params.delete('lowStock');
      } else if (value === 'in') {
        params.delete('lowStock');
        params.delete('outOfStock');
      }
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('lowStock');
    params.delete('outOfStock');
    params.delete('stockFilter');
    params.delete('search');
    params.delete('page');
    router.push(`/inventory?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={stockFilter} onValueChange={handleFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Stock Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="in">In Stock</SelectItem>
          <SelectItem value="low">Low Stock</SelectItem>
          <SelectItem value="out">Out of Stock</SelectItem>
        </SelectContent>
      </Select>

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
