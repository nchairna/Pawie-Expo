'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAllInventory, adjustInventory } from '@/lib/inventory';
import { getImageUrl } from '@/lib/images';
import type { InventoryWithProduct } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Loader2, Plus, Minus, History } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const LOW_STOCK_THRESHOLD = 10;

const reasonOptions = [
  { value: 'restock', label: 'Restock', type: 'add' },
  { value: 'damaged', label: 'Damaged', type: 'remove' },
  { value: 'lost', label: 'Lost', type: 'remove' },
  { value: 'audit_correction', label: 'Audit Correction', type: 'both' },
  { value: 'return', label: 'Customer Return', type: 'add' },
  { value: 'manual_adjustment', label: 'Manual Adjustment', type: 'both' },
];

function getStockStatus(stock: number): {
  label: string;
  color: string;
} {
  if (stock === 0) {
    return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
  }
  return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
}

export default function InventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [adjustingProductId, setAdjustingProductId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);

  // Fetch inventory
  useEffect(() => {
    async function fetchInventory() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllInventory({
          lowStock: stockFilter === 'low',
          outOfStock: stockFilter === 'out',
        });
        setInventory(data);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load inventory';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchInventory();
  }, [stockFilter]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (!item.product) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.product.name?.toLowerCase().includes(query);
        const matchesSku = item.product.sku?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      
      // Stock status filter
      if (stockFilter === 'all') return true;
      const status = getStockStatus(item.stock_quantity);
      if (stockFilter === 'in' && status.label === 'In Stock') return true;
      if (stockFilter === 'low' && status.label === 'Low Stock') return true;
      if (stockFilter === 'out' && status.label === 'Out of Stock') return true;
      return false;
    });
  }, [inventory, stockFilter, searchQuery]);

  const handleOpenAdjustDialog = (productId: string, currentStock: number) => {
    setAdjustingProductId(productId);
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setAdjustmentType('add');
    setShowAdjustDialog(true);
  };

  const handleAdjustInventory = async () => {
    if (!adjustingProductId || !adjustmentQuantity || !adjustmentReason) {
      toast.error('Please fill in all fields');
      return;
    }

    const quantity = parseInt(adjustmentQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const adjustment = adjustmentType === 'add' ? quantity : -quantity;

    try {
      setAdjusting(true);
      await adjustInventory(adjustingProductId, adjustment, adjustmentReason);
      toast.success('Inventory adjusted successfully');
      setShowAdjustDialog(false);
      // Refresh inventory
      const data = await getAllInventory({
        lowStock: stockFilter === 'low',
        outOfStock: stockFilter === 'out',
        search: searchQuery || undefined,
      });
      setInventory(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to adjust inventory';
      toast.error(errorMessage);
    } finally {
      setAdjusting(false);
    }
  };

  const availableReasons = useMemo(() => {
    return reasonOptions.filter(
      (reason) =>
        reason.type === 'both' ||
        (adjustmentType === 'add' && reason.type === 'add') ||
        (adjustmentType === 'remove' && reason.type === 'remove')
    );
  }, [adjustmentType]);

  const selectedProduct = adjustingProductId
    ? inventory.find((item) => item.product_id === adjustingProductId)
    : null;

  return (
    <div className="container mx-auto p-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Track and adjust product inventory levels
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
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
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredInventory.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No inventory found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => {
                const status = getStockStatus(item.stock_quantity);
                return (
                  <TableRow key={item.id}>
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
                    <TableCell className="font-medium">
                      {item.stock_quantity}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.updated_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleOpenAdjustDialog(item.product_id, item.stock_quantity)
                          }
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
                        <Link href={`/inventory/${item.product_id}/movements`}>
                          <Button variant="ghost" size="sm">
                            <History className="h-4 w-4 mr-1" />
                            History
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Adjust Inventory Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>
              {selectedProduct?.product?.name || 'Product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Current Stock</Label>
              <p className="text-2xl font-bold">
                {selectedProduct?.stock_quantity || 0}
              </p>
            </div>
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
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={adjustmentReason}
                onValueChange={setAdjustmentReason}
              >
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
            {adjustmentQuantity && adjustmentType && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">New Stock:</p>
                <p className="text-lg font-bold">
                  {selectedProduct?.stock_quantity || 0}{' '}
                  {adjustmentType === 'add' ? '+' : '-'}{' '}
                  {adjustmentQuantity} ={' '}
                  {adjustmentType === 'add'
                    ? (selectedProduct?.stock_quantity || 0) + parseInt(adjustmentQuantity || '0')
                    : Math.max(
                        0,
                        (selectedProduct?.stock_quantity || 0) -
                          parseInt(adjustmentQuantity || '0')
                      )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAdjustInventory} disabled={adjusting}>
              {adjusting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adjusting...
                </>
              ) : (
                'Apply Adjustment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
