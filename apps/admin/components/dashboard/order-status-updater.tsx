'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Save } from 'lucide-react';
import { updateOrderStatus } from '@/app/(dashboard)/orders/actions';

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
}

const validTransitions: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const availableStatuses = validTransitions[currentStatus] || [];

  const handleStatusUpdate = async () => {
    if (newStatus === currentStatus) return;

    // Show confirmation for cancellation
    if (newStatus === 'cancelled') {
      setShowCancelDialog(true);
      return;
    }

    await performStatusUpdate();
  };

  const performStatusUpdate = async () => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);

      if ('error' in result) {
        toast.error(result.error);
        setNewStatus(currentStatus); // Reset to current status on error
      } else {
        toast.success('Order status updated successfully');
        setShowCancelDialog(false);
        router.refresh(); // Refresh server component data
      }
    });
  };

  return (
    <>
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
              disabled={isPending || availableStatuses.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentStatus}>
                  {currentStatus} (current)
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
                isPending ||
                newStatus === currentStatus ||
                availableStatuses.length === 0
              }
            >
              {isPending ? (
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
              No status transitions available from {currentStatus}
            </p>
          )}
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
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={performStatusUpdate} disabled={isPending}>
              {isPending ? (
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
    </>
  );
}
