/**
 * Admin Autoship Detail Page
 * Phase 5 - Autoship System
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAutoshipById } from '@/lib/autoships';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AutoshipActions } from './autoship-actions';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'paused':
      return 'secondary';
    case 'cancelled':
      return 'outline';
    default:
      return 'default';
  }
}

function getRunStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'skipped':
      return 'outline';
    default:
      return 'default';
  }
}

export default async function AutoshipDetailPage({ params }: { params: { id: string } }) {
  const autoship = await getAutoshipById(params.id);

  if (!autoship) {
    notFound();
  }

  const pricePerDelivery = autoship.product?.base_price_idr
    ? autoship.product.base_price_idr * autoship.quantity
    : 0;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/autoships">
            <Button variant="ghost" size="sm" className="mb-2">
              ← Back to Autoships
            </Button>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">Autoship Details</h2>
        </div>
        <Badge variant={getStatusBadgeVariant(autoship.status)} className="text-lg px-4 py-2">
          {autoship.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Autoship Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Product</p>
              <div className="flex items-center gap-3">
                {autoship.product?.primary_image_path && (
                  <img
                    src={autoship.product.primary_image_path}
                    alt={autoship.product.name}
                    className="h-16 w-16 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium">{autoship.product?.name}</p>
                  <p className="text-sm text-muted-foreground">SKU: {autoship.product?.sku}</p>
                  <p className="text-sm">
                    {autoship.product?.base_price_idr
                      ? formatCurrency(autoship.product.base_price_idr)
                      : 'N/A'}{' '}
                    per unit
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity & Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quantity</p>
                <p className="text-2xl font-bold">{autoship.quantity}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Frequency</p>
                <p className="text-2xl font-bold">
                  {autoship.frequency_weeks === 1 ? '1 week' : `${autoship.frequency_weeks} weeks`}
                </p>
              </div>
            </div>

            {/* Price per delivery */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Price per Delivery</p>
              <p className="text-2xl font-bold">{formatCurrency(pricePerDelivery)}</p>
              <p className="text-xs text-muted-foreground">
                Autoship discounts applied at checkout
              </p>
            </div>

            {/* Next Run */}
            {autoship.status === 'active' && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Delivery</p>
                <p className="text-lg font-semibold">{formatDateTime(autoship.next_run_at)}</p>
              </div>
            )}

            {/* Pet */}
            {autoship.pet && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pet</p>
                <p className="font-medium">
                  {autoship.pet.name} {autoship.pet.species ? `(${autoship.pet.species})` : ''}
                </p>
              </div>
            )}

            {/* Created */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p>{formatDate(autoship.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="font-medium">{autoship.user?.email}</p>
            </div>
            {autoship.user?.full_name && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="font-medium">{autoship.user.full_name}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{autoship.user_id}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage this autoship subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <AutoshipActions autoship={autoship} />
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Past and scheduled autoship deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          {autoship.runs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No execution history yet
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Executed Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoship.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{formatDateTime(run.scheduled_at)}</TableCell>
                      <TableCell>
                        {run.executed_at ? formatDateTime(run.executed_at) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRunStatusBadgeVariant(run.status)}>{run.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {run.order_id ? (
                          <Link href={`/orders/${run.order_id}`}>
                            <Button variant="link" size="sm" className="h-auto p-0">
                              View Order
                            </Button>
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {run.error_message ? (
                          <span className="text-sm text-destructive">{run.error_message}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
