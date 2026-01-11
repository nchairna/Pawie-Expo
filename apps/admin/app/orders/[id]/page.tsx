'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getOrderById, updateOrderStatus } from '@/lib/orders';
import { getImageUrl } from '@/lib/images';
import type { OrderWithItems } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-red-100 text-red-800',
};

const validTransitions: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        setError(null);
        const data = await getOrderById(orderId);
        if (!data) {
          setError('Order not found');
          return;
        }
        setOrder(data);
        setNewStatus(data.status);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load order';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const handleStatusUpdate = async () => {
    if (!order || newStatus === order.status) return;

    // Show confirmation for cancellation
    if (newStatus === 'cancelled') {
      setShowCancelDialog(true);
      return;
    }

    await performStatusUpdate();
  };

  const performStatusUpdate = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const updated = await updateOrderStatus(order.id, newStatus);
      setOrder(updated);
      toast.success('Order status updated successfully');
      setShowCancelDialog(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update order status';
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const availableStatuses = order
    ? validTransitions[order.status] || []
    : [];

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto p-8">
        <div className="space-y-4">
          <Link href="/orders">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div className="text-center py-12 text-destructive">
            {error || 'Order not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Order Details</h1>
            <p className="text-muted-foreground font-mono text-sm">
              {order.id}
            </p>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}
              >
                {order.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Source</p>
              <Badge variant="outline">
                {order.source === 'one_time' ? 'One-Time' : 'Autoship'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(order.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDate(order.updated_at)}</p>
            </div>
          </div>

          {order.user && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Customer</p>
              <div className="space-y-1">
                <p className="font-medium">
                  {order.user.full_name || 'No name'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.user.email}
                </p>
              </div>
            </div>
          )}

          {order.address && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Shipping Address</p>
              <div className="space-y-1">
                {order.address.label && (
                  <p className="font-medium">{order.address.label}</p>
                )}
                <p className="text-sm">
                  {order.address.address_line}
                  {order.address.city && `, ${order.address.city}`}
                  {order.address.province && `, ${order.address.province}`}
                  {order.address.postal_code && ` ${order.address.postal_code}`}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update */}
      <Card>
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
          <CardDescription>
            Change the order status. Cancelling will restore inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select
              value={newStatus}
              onValueChange={setNewStatus}
              disabled={updating || availableStatuses.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={order.status}>
                  {order.status} (current)
                </SelectItem>
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleStatusUpdate}
              disabled={
                updating ||
                newStatus === order.status ||
                availableStatuses.length === 0
              }
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Status
                </>
              )}
            </Button>
          </div>
          {availableStatuses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No status transitions available from {order.status}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Base Price</TableHead>
                <TableHead>Unit Final Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
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
                        <p className="font-medium">{item.product?.name || 'Unknown Product'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.product?.sku || '-'}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatIDR(item.unit_base_price_idr)}</TableCell>
                  <TableCell>{formatIDR(item.unit_final_price_idr)}</TableCell>
                  <TableCell>
                    {item.discount_total_idr > 0 ? (
                      <span className="text-green-600">
                        -{formatIDR(item.discount_total_idr)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatIDR(
                      item.unit_final_price_idr * item.quantity
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Price Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatIDR(order.subtotal_idr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount Total</span>
              <span className="font-medium text-green-600">
                -{formatIDR(order.discount_total_idr)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold text-lg">Total</span>
              <span className="font-bold text-lg">{formatIDR(order.total_idr)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This will restore
              inventory for all items in the order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={performStatusUpdate} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
