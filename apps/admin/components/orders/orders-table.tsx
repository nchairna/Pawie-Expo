'use client';

import { useRouter } from 'next/navigation';
import type { Order } from '@/lib/types';
import { DataTable, Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ShoppingCart } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  paid: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  processing: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  shipped: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
  delivered: 'bg-green-100 text-green-800 hover:bg-green-200',
  cancelled: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  refunded: 'bg-red-100 text-red-800 hover:bg-red-200',
};

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('id-ID');
}

function truncateUUID(uuid: string): string {
  return uuid.substring(0, 8) + '...';
}

interface OrdersTableProps {
  orders: Order[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter();

  // Define columns using the Column interface
  const columns: Column<Order>[] = [
    {
      header: 'Order ID',
      accessor: (order) => (
        <span className="font-mono text-sm">{truncateUUID(order.id)}</span>
      ),
    },
    {
      header: 'Customer',
      accessor: (order) => order.user?.email || 'Unknown',
    },
    {
      header: 'Status',
      accessor: (order) => (
        <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
          {order.status}
        </Badge>
      ),
    },
    {
      header: 'Source',
      accessor: (order) => (
        <Badge variant="outline">
          {order.source === 'one_time' ? 'One-Time' : 'Autoship'}
        </Badge>
      ),
    },
    {
      header: 'Total',
      accessor: (order) => (
        <span className="font-medium">{formatIDR(order.total_idr)}</span>
      ),
    },
    {
      header: 'Date',
      accessor: (order) => (
        <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      accessor: (order) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/orders/${order.id}`);
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      ),
      headerClassName: 'text-right',
      className: 'text-right',
    },
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      keyExtractor={(order) => order.id}
      onRowClick={(order) => {
        router.push(`/orders/${order.id}`);
      }}
      emptyState={{
        icon: ShoppingCart,
        title: 'No orders found',
        description: 'No orders match your current filters. Try adjusting your search criteria.',
      }}
    />
  );
}
