'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAllDiscounts,
  toggleDiscountActive,
  deleteDiscount,
} from '@/lib/discounts';
import type { Discount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
} from 'lucide-react';

export default function DiscountsPage() {
  const router = useRouter();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(
    'all'
  );
  const [kindFilter, setKindFilter] = useState<'all' | 'promo' | 'autoship'>(
    'all'
  );
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch discounts
  useEffect(() => {
    async function fetchDiscounts() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllDiscounts();
        setDiscounts(data);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load discounts';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchDiscounts();
  }, []);

  // Filter discounts based on search query and filters
  const filteredDiscounts = useMemo(() => {
    let filtered = discounts;

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter((discount) =>
        discount.name.toLowerCase().includes(query)
      );
    }

    // Active filter
    if (activeFilter === 'active') {
      filtered = filtered.filter((d) => d.active);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter((d) => !d.active);
    }

    // Kind filter
    if (kindFilter !== 'all') {
      filtered = filtered.filter((d) => d.kind === kindFilter);
    }

    return filtered;
  }, [discounts, debouncedSearch, activeFilter, kindFilter]);

  const handleToggleActive = async (discount: Discount) => {
    if (togglingIds.has(discount.id)) return;

    try {
      setTogglingIds((prev) => new Set(prev).add(discount.id));
      await toggleDiscountActive(discount.id, !discount.active);
      setDiscounts((prev) =>
        prev.map((d) =>
          d.id === discount.id ? { ...d, active: !d.active } : d
        )
      );
      toast.success(
        `Discount ${!discount.active ? 'activated' : 'deactivated'} successfully`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle discount status';
      toast.error(errorMessage);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(discount.id);
        return next;
      });
    }
  };

  const handleDelete = async (discount: Discount) => {
    if (deletingIds.has(discount.id)) return;

    if (!confirm(`Are you sure you want to delete "${discount.name}"?`)) {
      return;
    }

    try {
      setDeletingIds((prev) => new Set(prev).add(discount.id));
      await deleteDiscount(discount.id);
      setDiscounts((prev) => prev.filter((d) => d.id !== discount.id));
      toast.success('Discount deleted successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete discount';
      toast.error(errorMessage);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(discount.id);
        return next;
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeWindow = (discount: Discount) => {
    if (!discount.starts_at && !discount.ends_at) {
      return 'Always active';
    }
    if (discount.starts_at && discount.ends_at) {
      return `${formatDate(discount.starts_at)} - ${formatDate(discount.ends_at)}`;
    }
    if (discount.starts_at) {
      return `From ${formatDate(discount.starts_at)}`;
    }
    if (discount.ends_at) {
      return `Until ${formatDate(discount.ends_at)}`;
    }
    return '—';
  };

  const formatValue = (discount: Discount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.value}%`;
    }
    return `Rp ${discount.value.toLocaleString('id-ID')}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading discounts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && discounts.length === 0) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Discounts</h1>
          <p className="text-muted-foreground">
            Manage discount rules and promotions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/discounts/preview')}
          >
            Pricing Preview
          </Button>
          <Button onClick={() => router.push('/discounts/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Discount
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={activeFilter} onValueChange={(v: any) => setActiveFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={(v: any) => setKindFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Kinds</SelectItem>
            <SelectItem value="promo">Promo</SelectItem>
            <SelectItem value="autoship">Autoship</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Discounts Table */}
      {filteredDiscounts.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            {discounts.length === 0
              ? 'No discounts yet. Create your first discount.'
              : 'No discounts match your filters.'}
          </p>
          {discounts.length === 0 && (
            <Button onClick={() => router.push('/discounts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Discount
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Time Window</TableHead>
                <TableHead>Stack Policy</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDiscounts.map((discount) => (
                <TableRow
                  key={discount.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking on toggle or actions
                    if (
                      (e.target as HTMLElement).closest('button') ||
                      (e.target as HTMLElement).closest('[role="menuitem"]') ||
                      (e.target as HTMLElement).closest('[role="switch"]')
                    ) {
                      return;
                    }
                    router.push(`/discounts/${discount.id}`);
                  }}
                >
                  <TableCell className="font-medium">
                    {discount.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        discount.kind === 'autoship' ? 'default' : 'secondary'
                      }
                    >
                      {discount.kind === 'autoship' ? 'Autoship' : 'Promo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {discount.discount_type === 'percentage'
                        ? 'Percentage'
                        : 'Fixed'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatValue(discount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatTimeWindow(discount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {discount.stack_policy === 'best_only'
                        ? 'Best Only'
                        : 'Stack'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={discount.active}
                      onCheckedChange={() => handleToggleActive(discount)}
                      disabled={togglingIds.has(discount.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/discounts/${discount.id}`);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(discount);
                          }}
                          disabled={deletingIds.has(discount.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deletingIds.has(discount.id) ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
