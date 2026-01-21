import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PackageCheck } from 'lucide-react';

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: 'out_of_stock' | 'low_stock' | 'in_stock';
}

interface LowStockAlertsProps {
  products: LowStockProduct[];
}

/**
 * Get badge variant for stock status
 */
function getStockStatusBadge(status: string) {
  switch (status) {
    case 'out_of_stock':
      return <Badge variant="destructive">Out of Stock</Badge>;
    case 'low_stock':
      return <Badge variant="secondary">Low Stock</Badge>;
    case 'in_stock':
      return <Badge variant="default">In Stock</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Low Stock Alerts Widget
 *
 * Shows products with low or out of stock status:
 * - Product name
 * - Current stock quantity
 * - Status badge (Out of Stock / Low Stock)
 * - Quick link to adjust inventory
 */
export function LowStockAlerts({ products }: LowStockAlertsProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={PackageCheck}
            title="All products well stocked"
            description="No inventory alerts at this time. Products will appear here when stock is low."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Low Stock Alerts
        </CardTitle>
        <Link
          href="/inventory?filter=low_stock"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {product.sku}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={
                      product.stock_quantity === 0
                        ? 'font-bold text-red-600'
                        : 'font-medium text-yellow-600'
                    }
                  >
                    {product.stock_quantity}
                  </span>
                </TableCell>
                <TableCell>{getStockStatusBadge(product.status)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/inventory?productId=${product.id}`}>
                      Adjust
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
