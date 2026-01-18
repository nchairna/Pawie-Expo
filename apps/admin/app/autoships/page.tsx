/**
 * Admin Autoship List Page
 * Phase 5 - Autoship System
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getAllAutoships, getAutoshipStats } from '@/lib/autoships';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    month: 'short',
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

async function AutoshipStats() {
  const stats = await getAutoshipStats();

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Autoships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalActive}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Paused</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalPaused}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Due Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.dueToday}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Last Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{stats.failedLastWeek}</div>
        </CardContent>
      </Card>
    </div>
  );
}

async function AutoshipTable({ status }: { status?: string }) {
  const autoships = await getAllAutoships({ status, limit: 100 });

  if (autoships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No autoships found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {autoships.map((autoship) => (
            <TableRow key={autoship.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{autoship.user?.email}</span>
                  {autoship.user?.full_name && (
                    <span className="text-sm text-muted-foreground">{autoship.user.full_name}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  {autoship.product?.primary_image_path && (
                    <img
                      src={autoship.product.primary_image_path}
                      alt={autoship.product.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{autoship.product?.name}</span>
                    <span className="text-sm text-muted-foreground">{autoship.product?.sku}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">{autoship.quantity}</TableCell>
              <TableCell>
                {autoship.frequency_weeks === 1
                  ? 'Weekly'
                  : `Every ${autoship.frequency_weeks} weeks`}
              </TableCell>
              <TableCell>
                {autoship.status === 'active' ? (
                  formatDateTime(autoship.next_run_at)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(autoship.status)}>
                  {autoship.status}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(autoship.created_at)}</TableCell>
              <TableCell className="text-right">
                <Link href={`/autoships/${autoship.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AutoshipsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Autoships</h2>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <AutoshipStats />
      </Suspense>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Autoships</CardTitle>
              <CardDescription>View and manage all autoship subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
                <AutoshipTable />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Autoships</CardTitle>
              <CardDescription>Currently active autoship subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
                <AutoshipTable status="active" />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paused">
          <Card>
            <CardHeader>
              <CardTitle>Paused Autoships</CardTitle>
              <CardDescription>Temporarily paused autoship subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
                <AutoshipTable status="paused" />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled">
          <Card>
            <CardHeader>
              <CardTitle>Cancelled Autoships</CardTitle>
              <CardDescription>Permanently cancelled autoship subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
                <AutoshipTable status="cancelled" />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
