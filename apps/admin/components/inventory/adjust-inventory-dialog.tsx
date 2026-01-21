'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { adjustInventory } from '@/app/(dashboard)/inventory/actions';
import type { InventoryWithProduct } from '@/lib/types';

const LOW_STOCK_THRESHOLD = 10;
const QUICK_PRESETS = [10, 25, 50, 100];

const reasonOptions = [
  { value: 'restock', label: 'Restock', type: 'add' },
  { value: 'damaged', label: 'Damaged', type: 'remove' },
  { value: 'lost', label: 'Lost', type: 'remove' },
  { value: 'audit_correction', label: 'Audit Correction', type: 'both' },
  { value: 'return', label: 'Customer Return', type: 'add' },
  { value: 'manual_adjustment', label: 'Manual Adjustment', type: 'both' },
];

interface AdjustInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryWithProduct | null;
}

export function AdjustInventoryDialog({
  open,
  onOpenChange,
  product,
}: AdjustInventoryDialogProps) {
  const router = useRouter();
  const [adjustmentMode, setAdjustmentMode] = useState<'adjust' | 'set'>('adjust');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  // Reset form when dialog opens or product changes
  useEffect(() => {
    if (open && product) {
      setAdjustmentQuantity('');
      setAdjustmentReason('');
      setAdjustmentType('add');
      setAdjustmentMode('adjust');
      setAdjusting(false);
    }
  }, [open, product]);

  const availableReasons = useMemo(() => {
    return reasonOptions.filter(
      (reason) =>
        reason.type === 'both' ||
        (adjustmentType === 'add' && reason.type === 'add') ||
        (adjustmentType === 'remove' && reason.type === 'remove')
    );
  }, [adjustmentType]);

  const newStockPreview = useMemo(() => {
    if (!adjustmentQuantity || !product) return null;
    const quantity = parseInt(adjustmentQuantity || '0');
    if (isNaN(quantity)) return null;

    const currentStock = product.stock_quantity || 0;
    let newStock: number;

    if (adjustmentMode === 'set') {
      newStock = quantity;
    } else {
      newStock =
        adjustmentType === 'add'
          ? currentStock + quantity
          : Math.max(0, currentStock - quantity);
    }

    return { newStock, currentStock };
  }, [adjustmentQuantity, adjustmentMode, adjustmentType, product]);

  const handleAdjustInventory = useCallback(async () => {
    if (!product) {
      toast.error('No product selected');
      return;
    }

    if (!product.product_id) {
      toast.error('Invalid product - missing product_id');
      return;
    }

    if (!adjustmentQuantity || !adjustmentReason) {
      toast.error('Please fill in all fields');
      return;
    }

    const quantity = parseInt(adjustmentQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const currentStock = product.stock_quantity || 0;
    let adjustment: number;

    if (adjustmentMode === 'set') {
      adjustment = quantity - currentStock;
    } else {
      adjustment = adjustmentType === 'add' ? quantity : -quantity;
    }

    // Validate: prevent negative stock
    if (currentStock + adjustment < 0) {
      toast.error(`Cannot remove more than available stock (${currentStock} units)`);
      return;
    }

    try {
      setAdjusting(true);

      // product is InventoryWithProduct, so product_id is at the top level
      const result = await adjustInventory(product.product_id, adjustment, adjustmentReason);

      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Inventory adjusted successfully');
        onOpenChange(false);
        router.refresh(); // Refresh server component data
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to adjust inventory';
      toast.error(errorMessage);
    } finally {
      setAdjusting(false);
    }
  }, [product, adjustmentQuantity, adjustmentReason, adjustmentMode, adjustmentType, onOpenChange, router]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (adjustmentQuantity && adjustmentReason && !adjusting && product) {
          handleAdjustInventory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, adjustmentQuantity, adjustmentReason, adjusting, product, handleAdjustInventory, onOpenChange]);

  // Don't render dialog content if no product is selected
  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            {product.product?.name || 'Unknown Product'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Current Stock</Label>
            <p className="text-2xl font-bold">{product.stock_quantity || 0}</p>
          </div>
          <div>
            <Label>Mode</Label>
            <Select
              value={adjustmentMode}
              onValueChange={(value) => {
                setAdjustmentMode(value as 'adjust' | 'set');
                if (value === 'set') {
                  setAdjustmentType('add');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjust">Adjust (Add/Remove)</SelectItem>
                <SelectItem value="set">Set to Exact Number</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {adjustmentMode === 'adjust' && (
            <div>
              <Label>Adjustment Type</Label>
              <Select
                value={adjustmentType}
                onValueChange={(value) => setAdjustmentType(value as 'add' | 'remove')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="remove">Remove Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="quantity">
              {adjustmentMode === 'set' ? 'Set Stock To' : 'Quantity'}
            </Label>
            <Input
              id="quantity"
              type="number"
              min={adjustmentMode === 'set' ? '0' : '1'}
              value={adjustmentQuantity}
              onChange={(e) => setAdjustmentQuantity(e.target.value)}
              placeholder={
                adjustmentMode === 'set'
                  ? 'Enter target stock level'
                  : 'Enter quantity'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (adjustmentQuantity && adjustmentReason && !adjusting) {
                    handleAdjustInventory();
                  }
                }
              }}
            />
            {adjustmentMode === 'adjust' && (
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setAdjustmentQuantity(preset.toString())}
                    className="h-8"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {availableReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {newStockPreview && (
            <div
              className={`p-4 rounded-md border-2 ${
                newStockPreview.newStock === 0
                  ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  : newStockPreview.newStock <= LOW_STOCK_THRESHOLD
                  ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                  : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              }`}
            >
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground">
                  {newStockPreview.currentStock}
                </span>
                {adjustmentMode === 'adjust' && (
                  <>
                    <span className="text-muted-foreground">
                      {adjustmentType === 'add' ? '+' : '-'}
                    </span>
                    <span className="text-muted-foreground">
                      {adjustmentQuantity}
                    </span>
                    <span className="text-muted-foreground">=</span>
                  </>
                )}
                {adjustmentMode === 'set' && (
                  <>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <span
                  className={`text-2xl font-bold ${
                    newStockPreview.newStock === 0
                      ? 'text-red-700 dark:text-red-400'
                      : newStockPreview.newStock <= LOW_STOCK_THRESHOLD
                      ? 'text-yellow-700 dark:text-yellow-400'
                      : 'text-green-700 dark:text-green-400'
                  }`}
                >
                  {newStockPreview.newStock}
                </span>
              </div>
              {newStockPreview.newStock < newStockPreview.currentStock &&
                newStockPreview.newStock < 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    ⚠️ Warning: This would result in negative stock
                  </p>
                )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel (Esc)
          </Button>
          <Button
            onClick={handleAdjustInventory}
            disabled={adjusting || !adjustmentQuantity || !adjustmentReason}
          >
            {adjusting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {adjustmentMode === 'set' ? 'Setting...' : 'Adjusting...'}
              </>
            ) : adjustmentMode === 'set' ? (
              'Set Stock'
            ) : (
              'Apply Adjustment'
            )}
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Ctrl+Enter (Cmd+Enter on Mac) to submit
        </p>
      </DialogContent>
    </Dialog>
  );
}
