'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, History } from 'lucide-react';
import { toast } from 'sonner';
import { adjustInventory } from '@/app/(dashboard)/inventory/actions';
import Link from 'next/link';
import type { InventoryWithProduct } from '@/lib/types';

interface InventoryActionsProps {
  item: InventoryWithProduct;
  onAdjust: (item: InventoryWithProduct) => void;
}

export function InventoryActions({ item, onAdjust }: InventoryActionsProps) {
  const router = useRouter();
  const [adjusting, setAdjusting] = useState(false);

  const handleQuickAdd = async (quantity: number) => {
    try {
      setAdjusting(true);
      const result = await adjustInventory(item.product_id, quantity, 'restock');

      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success(`Added ${quantity} units successfully`);
        router.refresh(); // Refresh server component data
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add stock');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      {item.stock_quantity === 0 ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdd(10)}
            disabled={adjusting}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add 10
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdd(50)}
            disabled={adjusting}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add 50
          </Button>
        </>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          // Pass the entire item object directly - no searching needed
          onAdjust(item);
        }}
      >
        {item.stock_quantity > 0 ? (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Adjust
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Add Stock
          </>
        )}
      </Button>
      {item.id && (
        <Link href={`/inventory/${item.product_id}/movements`}>
          <Button variant="ghost" size="sm">
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
        </Link>
      )}
    </div>
  );
}
