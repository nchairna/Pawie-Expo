'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getInventoryMovements, getInventoryByProductId } from '@/lib/inventory';
import { getProduct } from '@/lib/products';
import { getImageUrl } from '@/lib/images';
import type { InventoryMovement, Inventory, Product } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatChange(change: number): string {
  return change > 0 ? `+${change}` : `${change}`;
}

export default function InventoryMovementsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch product
        const productData = await getProduct(productId);
        setProduct(productData);

        // Fetch inventory
        const inventoryData = await getInventoryByProductId(productId);
        setInventory(inventoryData);

        // Fetch movements
        const movementsData = await getInventoryMovements(productId, {
          limit: 100,
        });
        setMovements(movementsData);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load data';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchData();
    }
  }, [productId]);

  // Calculate running stock for each movement
  const movementsWithStock = movements.map((movement, index) => {
    // Calculate stock after this movement by summing all previous movements
    const previousStock = movements
      .slice(0, index)
      .reduce((sum, m) => sum + m.change_quantity, inventory?.stock_quantity || 0);
    const stockAfter = previousStock - movement.change_quantity;
    return {
      ...movement,
      stockAfter,
    };
  });

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-8">
        <div className="space-y-4">
          <Link href="/inventory">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>
          <div className="text-center py-12 text-destructive">
            {error || 'Product not found'}
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
          <Link href="/inventory">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Inventory Movement History</h1>
            <p className="text-muted-foreground">{product.name}</p>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {product.primary_image_path && (
              <div className="relative w-20 h-20 rounded-md overflow-hidden">
                <Image
                  src={getImageUrl(product.primary_image_path)}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <p className="font-medium text-lg">{product.name}</p>
              {product.sku && (
                <p className="text-sm text-muted-foreground font-mono">
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Stock */}
      <Card>
        <CardHeader>
          <CardTitle>Current Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{inventory?.stock_quantity || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Last updated: {inventory?.updated_at ? formatDate(inventory.updated_at) : 'Never'}
          </p>
        </CardContent>
      </Card>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            Complete audit log of all inventory changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No inventory movements recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Stock After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsWithStock.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{formatDate(movement.created_at)}</TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          movement.change_quantity > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatChange(movement.change_quantity)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {movement.reason || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {movement.reference_id ? (
                        <Link
                          href={`/orders/${movement.reference_id}`}
                          className="text-primary hover:underline font-mono text-sm"
                        >
                          {movement.reference_id.substring(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {movement.stockAfter}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
