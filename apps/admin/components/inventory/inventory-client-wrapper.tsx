'use client';

import { useState, useCallback } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getImageUrl } from '@/lib/images';
import Image from 'next/image';
import type { InventoryWithProduct } from '@/lib/types';
import { InventoryActions } from './inventory-actions';
import { AdjustInventoryDialog } from './adjust-inventory-dialog';

const LOW_STOCK_THRESHOLD = 10;

function getStockStatus(item: InventoryWithProduct): {
  label: string;
  color: string;
} {
  if (item.id === null || item.id === undefined) {
    return {
      label: 'No Inventory Record',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    };
  }

  if (item.stock_quantity === 0) {
    return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
  }
  if (item.stock_quantity <= LOW_STOCK_THRESHOLD) {
    return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
  }
  return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
}

interface InventoryClientWrapperProps {
  inventory: InventoryWithProduct[];
}

export function InventoryClientWrapper({
  inventory,
}: InventoryClientWrapperProps) {
  const [adjustingProduct, setAdjustingProduct] =
    useState<InventoryWithProduct | null>(null);

  // Derived state - dialog is open when product is selected
  const showAdjustDialog = adjustingProduct !== null;

  // Accept the item directly - no searching needed, eliminates race conditions
  const handleOpenAdjustDialog = useCallback((item: InventoryWithProduct) => {
    // Set the product directly - no lookup required
    setAdjustingProduct(item);
  }, []);

  const handleCloseDialog = useCallback((open: boolean) => {
    if (!open) {
      console.log('Closing dialog and clearing product');
      setAdjustingProduct(null);
    }
  }, []);

  return (
    <>
      {inventory.map((item, index) => {
        const status = getStockStatus(item);
        return (
          <TableRow key={item.product_id || `inventory-${index}`}>
            <TableCell>
              <div className="flex items-center gap-3">
                {item.product?.primary_image_path && (
                  <div className="relative w-12 h-12 rounded-md overflow-hidden">
                    <Image
                      src={getImageUrl(item.product.primary_image_path)}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {item.product?.name || 'Unknown Product'}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="font-mono text-sm">
              {item.product?.sku || '-'}
            </TableCell>
            <TableCell className="font-medium">{item.stock_quantity}</TableCell>
            <TableCell>
              <Badge className={status.color}>{status.label}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {item.updated_at
                ? new Date(item.updated_at).toLocaleDateString('id-ID')
                : '-'}
            </TableCell>
            <TableCell className="text-right">
              <InventoryActions item={item} onAdjust={handleOpenAdjustDialog} />
            </TableCell>
          </TableRow>
        );
      })}

      {/* Adjust Inventory Dialog - Controlled by adjustingProduct state */}
      <AdjustInventoryDialog
        open={showAdjustDialog}
        onOpenChange={handleCloseDialog}
        product={adjustingProduct}
      />
    </>
  );
}
