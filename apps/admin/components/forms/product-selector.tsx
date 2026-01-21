'use client';

import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';

/**
 * ProductSelector Component
 *
 * A reusable product selector with search and modal for selecting single or multiple products.
 * Works with react-hook-form and supports custom product rendering.
 *
 * @example
 * ```tsx
 * // Single product selection
 * const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
 *
 * <ProductSelector
 *   products={allProducts}
 *   value={selectedProduct}
 *   onChange={setSelectedProduct}
 * />
 *
 * // Multiple product selection
 * const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
 *
 * <ProductSelector
 *   products={allProducts}
 *   value={selectedProducts}
 *   onChange={setSelectedProducts}
 *   multiple
 * />
 *
 * // With react-hook-form
 * <FormField
 *   control={form.control}
 *   name="product_ids"
 *   render={({ field }) => (
 *     <FormItem>
 *       <FormLabel>Products</FormLabel>
 *       <FormControl>
 *         <ProductSelector
 *           products={products}
 *           value={field.value}
 *           onChange={field.onChange}
 *           multiple
 *         />
 *       </FormControl>
 *       <FormMessage />
 *     </FormItem>
 *   )}
 * />
 * ```
 */

export interface ProductSelectorProps {
  /** Available products to select from */
  products: Product[];
  /** Selected product ID(s) - single string or array for multiple */
  value?: string | string[] | null;
  /** Callback when selection changes */
  onChange?: (value: string | string[] | null) => void;
  /** Enable multiple product selection */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className for trigger button */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Modal title */
  modalTitle?: string;
  /** Modal description */
  modalDescription?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** No results message */
  noResultsMessage?: string;
  /** Maximum number of products that can be selected (for multiple mode) */
  maxProducts?: number;
  /** Filter products by published status */
  publishedOnly?: boolean;
  /** Custom product renderer */
  renderProduct?: (product: Product, selected: boolean) => React.ReactNode;
}

export function ProductSelector({
  products,
  value,
  onChange,
  multiple = false,
  disabled = false,
  className,
  placeholder = 'Select product(s)...',
  modalTitle = 'Select Products',
  modalDescription = 'Search and select products',
  emptyMessage = 'No products available',
  noResultsMessage = 'No products found matching your search',
  maxProducts,
  publishedOnly = false,
  renderProduct,
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize value to always be an array internally
  const selectedIds = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Filter products
  const availableProducts = useMemo(() => {
    let filtered = products;

    // Filter by published status
    if (publishedOnly) {
      filtered = filtered.filter((p) => p.published);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, publishedOnly, searchQuery]);

  // Get selected products for display
  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedIds.includes(p.id));
  }, [products, selectedIds]);

  // Handle product selection
  const handleSelect = useCallback(
    (productId: string) => {
      if (disabled || !onChange) return;

      if (multiple) {
        const isSelected = selectedIds.includes(productId);

        if (isSelected) {
          // Remove product
          const newValue = selectedIds.filter((id) => id !== productId);
          onChange(newValue);
        } else {
          // Add product (check max limit)
          if (maxProducts && selectedIds.length >= maxProducts) {
            return;
          }
          onChange([...selectedIds, productId]);
        }
      } else {
        // Single selection - close modal after selection
        onChange(productId);
        setOpen(false);
      }
    },
    [disabled, onChange, multiple, selectedIds, maxProducts]
  );

  // Handle remove product
  const handleRemove = useCallback(
    (productId: string) => {
      if (disabled || !onChange) return;

      if (multiple) {
        onChange(selectedIds.filter((id) => id !== productId));
      } else {
        onChange(null);
      }
    },
    [disabled, onChange, multiple, selectedIds]
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(multiple ? [] : null);
  }, [disabled, onChange, multiple]);

  // Check if max reached
  const isMaxReached = maxProducts !== undefined && maxProducts > 0 && selectedIds.length >= maxProducts;

  // Format trigger button text
  const triggerText = useMemo(() => {
    if (selectedProducts.length === 0) {
      return placeholder;
    }
    if (selectedProducts.length === 1) {
      return selectedProducts[0].name;
    }
    return `${selectedProducts.length} products selected`;
  }, [selectedProducts, placeholder]);

  return (
    <div className={cn('space-y-2', className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              'w-full justify-between',
              !selectedIds.length && 'text-muted-foreground'
            )}
          >
            <span className="truncate">{triggerText}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>{modalDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, SKU, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Max warning */}
            {isMaxReached && (
              <p className="text-sm text-muted-foreground">
                Maximum of {maxProducts} products reached
              </p>
            )}

            {/* Product List */}
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {products.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {noResultsMessage}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableProducts.map((product) => {
                    const isSelected = selectedIds.includes(product.id);

                    // Custom renderer
                    if (renderProduct) {
                      return (
                        <div
                          key={product.id}
                          onClick={() => handleSelect(product.id)}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          {renderProduct(product, isSelected)}
                        </div>
                      );
                    }

                    // Default renderer
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelect(product.id)}
                        disabled={isMaxReached && !isSelected}
                        className={cn(
                          'w-full flex items-start gap-3 p-3 text-left transition-colors',
                          'hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted',
                          isSelected && 'bg-muted/50',
                          isMaxReached && !isSelected && 'opacity-40'
                        )}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            'mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>

                        {/* Product image */}
                        {product.primary_image_path && (
                          <div className="h-12 w-12 rounded border overflow-hidden flex-shrink-0 bg-muted">
                            <img
                              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${product.primary_image_path}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {product.sku && (
                              <span className="text-xs text-muted-foreground">
                                SKU: {product.sku}
                              </span>
                            )}
                            {product.category && (
                              <span className="text-xs text-muted-foreground">
                                • {product.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {!product.published && (
                              <Badge variant="outline" className="text-xs">
                                Unpublished
                              </Badge>
                            )}
                            {product.base_price_idr && (
                              <span className="text-xs font-medium">
                                Rp {product.base_price_idr.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selection counter */}
            {products.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {selectedIds.length} of {products.length} selected
                {maxProducts && ` (max: ${maxProducts})`}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected products display */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
          {selectedProducts.map((product) => (
            <Badge key={product.id} variant="default" className="pl-2.5 pr-1.5 py-1 gap-1">
              <span className="text-xs font-medium truncate max-w-[200px]">
                {product.name}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(product.id)}
                  className="ml-1 rounded-sm hover:bg-primary-foreground/20 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {!disabled && multiple && selectedProducts.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
