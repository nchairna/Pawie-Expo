'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  getDiscountById,
  updateDiscount,
  setDiscountTargets,
  hasActiveGlobalAutoshipDiscount,
} from '@/lib/discounts';
import { getProducts } from '@/lib/products';
import { getFamilies } from '@/lib/families';

import type { Product, ProductFamily, DiscountWithTargets } from '@/lib/types';
import { ProductSelector } from '@/components/product-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const updateDiscountSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    kind: z.enum(['promo', 'autoship']),
    discount_type: z.enum(['percentage', 'fixed']),
    value: z.number().int().positive('Value must be positive'),
    active: z.boolean(),
    starts_at: z.string().optional().nullable(),
    ends_at: z.string().optional().nullable(),
    min_order_subtotal_idr: z
      .number()
      .int()
      .min(0, 'Min order must be 0 or greater')
      .optional()
      .nullable(),
    stack_policy: z.enum(['best_only', 'stack']),
    usage_limit: z.number().int().positive().optional().nullable(),
    target_type: z.enum(['all_products', 'specific_products']),
    product_ids: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.discount_type === 'percentage' && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage value cannot exceed 100',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      if (data.starts_at && data.ends_at) {
        return new Date(data.starts_at) < new Date(data.ends_at);
      }
      return true;
    },
    {
      message: 'Start date must be before end date',
      path: ['ends_at'],
    }
  )
  .refine(
    (data) => {
      if (data.target_type === 'specific_products') {
        return data.product_ids && data.product_ids.length > 0;
      }
      return true;
    },
    {
      message: 'At least one product must be selected',
      path: ['product_ids'],
    }
  );

type UpdateDiscountFormValues = z.infer<typeof updateDiscountSchema>;

export default function EditDiscountPage() {
  const router = useRouter();
  const params = useParams();
  const discountId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState<DiscountWithTargets | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [hasGlobalAutoship, setHasGlobalAutoship] = useState(false);
  const [checkingAutoship, setCheckingAutoship] = useState(false);

  const form = useForm<UpdateDiscountFormValues>({
    resolver: zodResolver(updateDiscountSchema),
    defaultValues: {
      name: '',
      kind: 'promo',
      discount_type: 'percentage',
      value: 0,
      active: true,
      starts_at: null,
      ends_at: null,
      min_order_subtotal_idr: null,
      stack_policy: 'best_only',
      usage_limit: null,
      target_type: 'all_products',
      product_ids: [],
    },
  });

  const watchedKind = form.watch('kind');
  const watchedTargetType = form.watch('target_type');
  const watchedDiscountType = form.watch('discount_type');

  // Fetch discount, products, and families
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [discountData, productsData, familiesData] = await Promise.all([
          getDiscountById(discountId),
          getProducts(),
          getFamilies(),
        ]);

        if (!discountData) {
          toast.error('Discount not found');
          router.push('/discounts');
          return;
        }

        setDiscount(discountData);
        setProducts(productsData);
        setFamilies(familiesData);

        // Determine target type
        const hasAllProducts = discountData.targets.some(
          (t) => t.applies_to_all_products
        );
        const productIds = discountData.targets
          .filter((t) => t.product_id)
          .map((t) => t.product_id!);

        // Populate form
        form.reset({
          name: discountData.name,
          kind: discountData.kind,
          discount_type: discountData.discount_type,
          value: discountData.value,
          active: discountData.active,
          starts_at: discountData.starts_at,
          ends_at: discountData.ends_at,
          min_order_subtotal_idr: discountData.min_order_subtotal_idr,
          stack_policy: discountData.stack_policy,
          usage_limit: discountData.usage_limit,
          target_type: hasAllProducts ? 'all_products' : 'specific_products',
          product_ids: productIds,
        });
      } catch (err: any) {
        toast.error(`Failed to load discount: ${err.message}`);
        router.push('/discounts');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [discountId, router, form]);

  // Check for existing global autoship discount when kind changes
  useEffect(() => {
    async function checkAutoship() {
      if (watchedKind === 'autoship' && discount) {
        setCheckingAutoship(true);
        try {
          const exists = await hasActiveGlobalAutoshipDiscount();
          // Only show warning if another discount exists (not this one)
          setHasGlobalAutoship(exists && discount.kind !== 'autoship');
        } catch (err: any) {
          toast.error(`Failed to check autoship discount: ${err.message}`);
        } finally {
          setCheckingAutoship(false);
        }
      } else {
        setHasGlobalAutoship(false);
      }
    }
    checkAutoship();
  }, [watchedKind, discount]);

  // Auto-set target_type to 'all_products' for autoship discounts
  useEffect(() => {
    if (watchedKind === 'autoship') {
      form.setValue('target_type', 'all_products');
    }
  }, [watchedKind, form]);

  const onSubmit = async (values: UpdateDiscountFormValues) => {
    if (!discount) return;

    // Validate autoship discount (only if changing to autoship)
    if (
      values.kind === 'autoship' &&
      hasGlobalAutoship &&
      discount.kind !== 'autoship'
    ) {
      toast.error(
        'A global autoship discount already exists. Deactivate it first or edit the existing one.'
      );
      return;
    }

    // Validate autoship must target all products
    if (values.kind === 'autoship' && values.target_type !== 'all_products') {
      toast.error('Autoship discounts must target all products (MVP requirement)');
      return;
    }

    setSaving(true);

    try {
      // Update discount
      await updateDiscount(discountId, {
        name: values.name,
        kind: values.kind,
        discount_type: values.discount_type,
        value: values.value,
        active: values.active,
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
        min_order_subtotal_idr: values.min_order_subtotal_idr || null,
        stack_policy: values.stack_policy,
        usage_limit: values.usage_limit || null,
      });

      // Update targets
      await setDiscountTargets(discountId, {
        product_ids:
          values.target_type === 'specific_products'
            ? values.product_ids
            : undefined,
        applies_to_all_products: values.target_type === 'all_products',
      });

      toast.success('Discount updated successfully');
      router.push('/discounts');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update discount';
      toast.error(errorMessage);
      setSaving(false);
    }
  };

  const formatDateTimeLocal = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading discount...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!discount) {
    return null;
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/discounts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Discounts
        </Link>
        <h1 className="text-3xl font-bold">Edit Discount</h1>
        <p className="text-muted-foreground mt-2">
          Update discount details and targets
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discount Information</CardTitle>
          <CardDescription>
            Update the details below to modify this discount
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Autoship Warning */}
              {watchedKind === 'autoship' &&
                hasGlobalAutoship &&
                discount.kind !== 'autoship' && (
                  <div className="p-4 border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Global Autoship Discount Exists
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        A global autoship discount already exists. Deactivate it
                        first before changing this discount to autoship.
                      </p>
                    </div>
                  </div>
                )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Summer Sale 20% Off"
                        {...field}
                        disabled={saving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={saving || checkingAutoship}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="promo">Promo</SelectItem>
                        <SelectItem value="autoship">Autoship</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Promo: General promotions. Autoship: Discounts for
                      recurring orders.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={saving}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Value *{' '}
                        {watchedDiscountType === 'percentage'
                          ? '(0-100)'
                          : '(IDR)'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max={watchedDiscountType === 'percentage' ? '100' : undefined}
                          placeholder={
                            watchedDiscountType === 'percentage' ? '10' : '5000'
                          }
                          {...field}
                          value={field.value || ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? 0
                                : parseInt(e.target.value) || 0
                            )
                          }
                          disabled={saving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="stack_policy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stack Policy *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={saving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="best_only">Best Only</SelectItem>
                        <SelectItem value="stack">Stack</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Best Only: Take highest discount. Stack: Combine with
                      other discounts.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={saving}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Only active discounts are applied to prices
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starts At (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={formatDateTimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null
                            )
                          }
                          disabled={saving}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty for always active (typical for autoship)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ends At (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={formatDateTimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null
                            )
                          }
                          disabled={saving}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty for always active (typical for autoship)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="min_order_subtotal_idr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Order Subtotal (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="e.g., 200000"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : parseInt(e.target.value) || null
                          )
                        }
                        disabled={saving}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum cart total required for this discount to apply
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usage_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Limit (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Unlimited if empty"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : parseInt(e.target.value) || null
                          )
                        }
                        disabled={saving}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of times this discount can be used
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Targets Section */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-semibold">Targets *</Label>
                  <p className="text-sm text-muted-foreground">
                    {watchedKind === 'autoship'
                      ? 'Autoship discounts apply to all autoship-eligible products'
                      : 'Select which products this discount applies to'}
                  </p>
                </div>

                {watchedKind === 'autoship' ? (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      This discount will apply to all products where{' '}
                      <code className="text-xs bg-background px-1 py-0.5 rounded">
                        autoship_eligible = true
                      </code>
                    </p>
                  </div>
                ) : (
                  <>
                    <FormField
                      control={form.control}
                      name="target_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={saving}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all_products">
                                All Products
                              </SelectItem>
                              <SelectItem value="specific_products">
                                Specific Products
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedTargetType === 'specific_products' && (
                      <FormField
                        control={form.control}
                        name="product_ids"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Products *</FormLabel>
                            <FormControl>
                              <ProductSelector
                                products={products}
                                families={families}
                                selectedProductIds={field.value || []}
                                onSelectionChange={field.onChange}
                                disabled={saving}
                              />
                            </FormControl>
                            <FormDescription>
                              Search and filter products to select
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={saving || hasGlobalAutoship}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/discounts')}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
