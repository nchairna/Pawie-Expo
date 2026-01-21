import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Package, AlertCircle, Tag } from 'lucide-react';

/**
 * Quick Actions Component
 *
 * Provides fast access to common admin operations:
 * - Create Product
 * - View Pending Orders
 * - Adjust Inventory
 * - Create Discount
 */
export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            asChild
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Link href="/products/new">
              <Plus className="h-5 w-5" />
              <span className="text-sm">Create Product</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Link href="/orders?status=pending">
              <Package className="h-5 w-5" />
              <span className="text-sm">Pending Orders</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Link href="/inventory">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">Adjust Inventory</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Link href="/discounts/new">
              <Tag className="h-5 w-5" />
              <span className="text-sm">Create Discount</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
