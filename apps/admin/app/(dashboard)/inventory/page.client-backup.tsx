'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { Search, Loader2, Plus, Minus, History, Package, AlertTriangle, XCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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

function getStockStatus(item: InventoryWithProduct): {
  label: string;
  color: string;
} {
  // Check if product has no inventory record (id is null/undefined)
  if (item.id === null || item.id === undefined) {
    return { label: 'No Inventory Record', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
  }
  
  // Product has inventory record, check stock level
  if (item.stock_quantity === 0) {
    return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
  }
  if (item.stock_quantity <= LOW_STOCK_THRESHOLD) {
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
  const [adjustmentMode, setAdjustmentMode] = useState<'adjust' | 'set'>('adjust');
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
          search: searchQuery || undefined,
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
  }, [stockFilter, searchQuery]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (!item.product) return false;
      
      // Search filter is now handled by RPC function, but keep client-side filter as fallback
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.product.name?.toLowerCase().includes(query);
        const matchesSku = item.product.sku?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      
      // Stock status filter
      if (stockFilter === 'all') return true;
      const status = getStockStatus(item);
      if (stockFilter === 'in' && status.label === 'In Stock') return true;
      if (stockFilter === 'low' && status.label === 'Low Stock') return true;
      if (stockFilter === 'out' && (status.label === 'Out of Stock' || status.label === 'No Inventory Record')) return true;
      return false;
    });
  }, [inventory, stockFilter, searchQuery]);

  const handleOpenAdjustDialog = (productId: string, currentStock: number) => {
    setAdjustingProductId(productId);
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setAdjustmentType('add');
    setAdjustmentMode('adjust');
    setShowAdjustDialog(true);
  };

  const handleQuickAdd = async (productId: string, quantity: number) => {
    try {
      setAdjusting(true);
      await adjustInventory(productId, quantity, 'restock');
      toast.success(`Added ${quantity} units successfully`);
      // Refresh inventory
      const data = await getAllInventory({
        lowStock: stockFilter === 'low',
        outOfStock: stockFilter === 'out',
      });
      setInventory(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add stock');
    } finally {
      setAdjusting(false);
    }
  };

  const handleAdjustInventory = useCallback(async () => {
    if (!adjustingProductId || !adjustmentQuantity || !adjustmentReason) {
      toast.error('Please fill in all fields');
      return;
    }

    const quantity = parseInt(adjustmentQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    // Find selected product from inventory
    const currentProduct = inventory.find((item) => item.product_id === adjustingProductId);
    const currentStock = currentProduct?.stock_quantity || 0;
    let adjustment: number;

    if (adjustmentMode === 'set') {
      // Set to exact number
      adjustment = quantity - currentStock;
    } else {
      // Adjust (add or remove)
      adjustment = adjustmentType === 'add' ? quantity : -quantity;
    }

    // Validate: prevent negative stock
    if (currentStock + adjustment < 0) {
      toast.error(`Cannot remove more than available stock (${currentStock} units)`);
      return;
    }

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
  }, [adjustingProductId, adjustmentQuantity, adjustmentReason, adjustmentMode, adjustmentType, inventory, stockFilter, searchQuery]);

  // Calculate stock summary
  const stockSummary = useMemo(() => {
    const inStock = inventory.filter(item => item.stock_quantity > LOW_STOCK_THRESHOLD).length;
    const lowStock = inventory.filter(item => item.stock_quantity > 0 && item.stock_quantity <= LOW_STOCK_THRESHOLD).length;
    const outOfStock = inventory.filter(item => item.stock_quantity === 0).length;
    return { inStock, lowStock, outOfStock, total: inventory.length };
  }, [inventory]);

  // Calculate new stock for preview
  const newStockPreview = useMemo(() => {
    if (!adjustmentQuantity || !adjustingProductId) return null;
    const quantity = parseInt(adjustmentQuantity || '0');
    if (isNaN(quantity)) return null;

    // Find selected product from inventory
    const currentProduct = inventory.find((item) => item.product_id === adjustingProductId);
    if (!currentProduct) return null;

    const currentStock = currentProduct.stock_quantity || 0;
    let newStock: number;

    if (adjustmentMode === 'set') {
      newStock = quantity;
    } else {
      newStock = adjustmentType === 'add' 
        ? currentStock + quantity 
        : Math.max(0, currentStock - quantity);
    }

    return { newStock, currentStock };
  }, [adjustmentQuantity, adjustmentMode, adjustmentType, adjustingProductId, inventory]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!showAdjustDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAdjustDialog(false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (adjustmentQuantity && adjustmentReason && !adjusting && adjustingProductId) {
          handleAdjustInventory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdjustDialog, adjustmentQuantity, adjustmentReason, adjusting, adjustingProductId, handleAdjustInventory]);

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

      {/* Stock Summary Cards */}
      {!loading && inventory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stockSummary.total}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stockSummary.inStock}</p>
              </div>
              <Package className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stockSummary.lowStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stockSummary.outOfStock}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      )}

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
          {inventory.length === 0 ? (
            <div className="space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">No inventory records found</p>
                <p className="text-muted-foreground mt-2">
                  Inventory records are created automatically when products are added or orders are placed.
                  <br />
                  If you have products but no inventory, you can add stock using the Adjust button.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">No inventory found matching your filters.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStockFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
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
                const status = getStockStatus(item);
                return (
                  <TableRow key={item.product_id}>
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
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {item.stock_quantity === 0 ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickAdd(item.product_id, 10)}
                              disabled={adjusting}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add 10
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickAdd(item.product_id, 50)}
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
                        {item.id && (
                          <Link href={`/inventory/${item.product_id}/movements`}>
                            <Button variant="ghost" size="sm">
                              <History className="h-4 w-4 mr-1" />
                              History
                            </Button>
                          </Link>
                        )}
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
              <Label>Mode</Label>
              <Select
                value={adjustmentMode}
                onValueChange={(value) => {
                  setAdjustmentMode(value as 'adjust' | 'set');
                  if (value === 'set') {
                    setAdjustmentType('add'); // Reset type when switching to set mode
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
                placeholder={adjustmentMode === 'set' ? 'Enter target stock level' : 'Enter quantity'}
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
            {newStockPreview && (
              <div className={`p-4 rounded-md border-2 ${
                newStockPreview.newStock === 0
                  ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  : newStockPreview.newStock <= LOW_STOCK_THRESHOLD
                  ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                  : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              }`}>
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
                  <span className={`text-2xl font-bold ${
                    newStockPreview.newStock === 0
                      ? 'text-red-700 dark:text-red-400'
                      : newStockPreview.newStock <= LOW_STOCK_THRESHOLD
                      ? 'text-yellow-700 dark:text-yellow-400'
                      : 'text-green-700 dark:text-green-400'
                  }`}>
                    {newStockPreview.newStock}
                  </span>
                </div>
                {newStockPreview.newStock < newStockPreview.currentStock && newStockPreview.newStock < 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    ⚠️ Warning: This would result in negative stock
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
            >
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
              ) : (
                adjustmentMode === 'set' ? 'Set Stock' : 'Apply Adjustment'
              )}
            </Button>
          </DialogFooter>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Ctrl+Enter (Cmd+Enter on Mac) to submit
          </p>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
