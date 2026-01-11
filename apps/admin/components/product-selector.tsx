'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, CheckSquare, Square } from 'lucide-react';
import type { Product, ProductFamily } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  products: Product[];
  families: ProductFamily[];
  selectedProductIds: string[];
  onSelectionChange: (productIds: string[]) => void;
  disabled?: boolean;
}

export function ProductSelector({
  products,
  families,
  selectedProductIds,
  onSelectionChange,
  disabled = false,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by family
    if (selectedFamilyId !== 'all') {
      filtered = filtered.filter(
        (p) => p.family_id === selectedFamilyId
      );
    }

    // Filter by search query
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.category && p.category.toLowerCase().includes(query)) ||
          (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [products, selectedFamilyId, debouncedSearch]);

  const handleToggleProduct = (productId: string) => {
    const newSelection = selectedProductIds.includes(productId)
      ? selectedProductIds.filter((id) => id !== productId)
      : [...selectedProductIds, productId];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allIds = filteredProducts.map((p) => p.id);
    const newSelection = [
      ...new Set([...selectedProductIds, ...allIds]),
    ];
    onSelectionChange(newSelection);
  };

  const handleDeselectAll = () => {
    const filteredIds = filteredProducts.map((p) => p.id);
    const newSelection = selectedProductIds.filter(
      (id) => !filteredIds.includes(id)
    );
    onSelectionChange(newSelection);
  };

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const someFilteredSelected =
    filteredProducts.some((p) => selectedProductIds.includes(p.id)) &&
    !allFilteredSelected;

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="family-filter" className="text-sm">
              Filter by Family
            </Label>
            <Select
              value={selectedFamilyId}
              onValueChange={setSelectedFamilyId}
              disabled={disabled}
            >
              <SelectTrigger id="family-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {families.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 pt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={disabled || filteredProducts.length === 0}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={disabled || filteredProducts.length === 0}
            >
              <Square className="h-4 w-4 mr-2" />
              Deselect All
            </Button>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {selectedProductIds.length} of {products.length} products selected
          {filteredProducts.length !== products.length && (
            <span className="ml-2">
              ({filteredProducts.length} shown)
            </span>
          )}
        </div>
        {selectedProductIds.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={disabled}
            className="h-auto py-1"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Product List */}
      <div className="border rounded-lg">
        <div className="max-h-[400px] overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {products.length === 0
                ? 'No products available'
                : 'No products match your filters'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <div
                    key={product.id}
                    className={cn(
                      'flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer',
                      isSelected && 'bg-primary/5'
                    )}
                    onClick={() => !disabled && handleToggleProduct(product.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={cn(
                          'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground'
                        )}
                      >
                        {isSelected && (
                          <CheckSquare className="h-3 w-3 text-primary-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {product.sku && (
                            <span className="truncate">SKU: {product.sku}</span>
                          )}
                          {product.category && (
                            <span className="truncate">• {product.category}</span>
                          )}
                          {product.family_id && (
                            <Badge variant="outline" className="text-xs">
                              Family
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {product.base_price_idr && (
                      <div className="text-sm font-medium text-muted-foreground shrink-0">
                        Rp {product.base_price_idr.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Products Summary (if any selected) */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm font-medium mb-2">
            Selected Products ({selectedProductIds.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedProductIds
              .map((id) => products.find((p) => p.id === id))
              .filter(Boolean)
              .slice(0, 10)
              .map((product) => (
                <Badge
                  key={product!.id}
                  variant="secondary"
                  className="text-xs"
                >
                  {product!.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleProduct(product!.id);
                    }}
                    disabled={disabled}
                    className="ml-2 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            {selectedProductIds.length > 10 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedProductIds.length - 10} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
