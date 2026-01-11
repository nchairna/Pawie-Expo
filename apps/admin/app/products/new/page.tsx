'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createProduct } from '@/lib/products';
import { getFamilies } from '@/lib/families';
import { getFamily } from '@/lib/families';
import { getTags, setProductTags } from '@/lib/tags';
import type { ProductFamily, FamilyWithDimensions, ProductTag } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  family_id: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  autoship_eligible: z.boolean().default(false),
  base_price_idr: z
    .number()
    .int('Price must be an integer')
    .min(0, 'Price must be 0 or greater')
    .optional()
    .nullable(),
  sku: z.string().optional().nullable(),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<FamilyWithDimensions | null>(null);
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      family_id: '',
      category: '',
      description: '',
      autoship_eligible: false,
      base_price_idr: null,
      sku: null,
    },
  });

  // Fetch families and tags
  useEffect(() => {
    async function fetchData() {
      try {
        const [familiesData, tagsData] = await Promise.all([
          getFamilies(),
          getTags(),
        ]);
        setFamilies(familiesData);
        setTags(tagsData);
      } catch (err: any) {
        toast.error(`Failed to load data: ${err.message}`);
      }
    }
    fetchData();
  }, []);

  // Load family details when selected
  const handleFamilyChange = async (familyId: string | undefined) => {
    if (!familyId) {
      setSelectedFamily(null);
      setSelectedVariantValues({});
      return;
    }

    setLoadingFamily(true);
    try {
      const familyData = await getFamily(familyId);
      setSelectedFamily(familyData);
      // Reset variant value selections
      setSelectedVariantValues({});
    } catch (err: any) {
      toast.error(`Failed to load family: ${err.message}`);
      setSelectedFamily(null);
    } finally {
      setLoadingFamily(false);
    }
  };

  // Watch family_id changes
  const watchedFamilyId = form.watch('family_id');
  useEffect(() => {
    handleFamilyChange(watchedFamilyId);
  }, [watchedFamilyId]);

  const onSubmit = async (values: CreateProductFormValues) => {
    setLoading(true);

    try {
      // Validate variant values if family is selected
      if (selectedFamily && selectedFamily.dimensions.length > 0) {
        const missingDimensions = selectedFamily.dimensions.filter(
          (dim) => !selectedVariantValues[dim.id]
        );
        if (missingDimensions.length > 0) {
          toast.error(
            `Please select values for all dimensions: ${missingDimensions.map((d) => d.name).join(', ')}`
          );
          setLoading(false);
          return;
        }
      }

      const variantValueIds = selectedFamily
        ? Object.values(selectedVariantValues).filter(Boolean)
        : undefined;

      // Validate price and SKU if family is selected
      if (selectedFamily && (!values.base_price_idr || !values.sku)) {
        toast.error('Price and SKU are required for family-based products');
        setLoading(false);
        return;
      }

      const product = await createProduct({
        name: values.name,
        family_id: values.family_id || null,
        category: values.category || null,
        description: values.description || null,
        autoship_eligible: values.autoship_eligible,
        base_price_idr: values.base_price_idr ?? null,
        sku: values.sku || null,
        variant_value_ids: variantValueIds,
      });

      // Assign tags if selected
      if (selectedTagIds.length > 0) {
        await setProductTags(product.id, selectedTagIds);
      }

      toast.success('Product created successfully');
      router.push(`/products/${product.id}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create product';
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold">Create New Product</h1>
        <p className="text-muted-foreground mt-2">
          Add a new product to your catalog
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Fill in the details below to create a new product. The product will
            be created as unpublished.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter product name"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="family_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Family (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        // Handle sentinel value for "none"
                        if (value === '__none__') {
                          field.onChange(undefined);
                        } else {
                          field.onChange(value);
                        }
                      }}
                      value={field.value || '__none__'}
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a family (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None (Standalone Product)</SelectItem>
                        {families.map((family) => (
                          <SelectItem key={family.id} value={family.id}>
                            {family.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign to a family to enable variant dimension navigation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Variant Value Selectors */}
              {selectedFamily && selectedFamily.dimensions.length > 0 && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-base font-semibold">
                      Variant Values
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Select one value for each dimension
                    </p>
                  </div>
                  {selectedFamily.dimensions.map((dimension) => (
                    <div key={dimension.id}>
                      <Label className="text-sm font-medium">
                        {dimension.name} *
                      </Label>
                      <Select
                        value={selectedVariantValues[dimension.id] || ''}
                        onValueChange={(value) => {
                          setSelectedVariantValues((prev) => ({
                            ...prev,
                            [dimension.id]: value,
                          }));
                        }}
                        disabled={loading || loadingFamily}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={`Select ${dimension.name.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {dimension.values.map((value) => (
                            <SelectItem key={value.id} value={value.id}>
                              {value.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {/* Price and SKU - Required for family-based products */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-semibold">
                    Price & SKU
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedFamily
                      ? 'Set the price and SKU for this specific variant combination'
                      : 'Set the price and SKU for this product'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="base_price_idr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (IDR) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? null
                                  : parseInt(e.target.value) || 0
                              )
                            }
                            disabled={loading}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter price as an integer (no decimals)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., PROD-001"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={loading}
                          />
                        </FormControl>
                        <FormDescription>
                          Stock Keeping Unit identifier
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Legacy)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Food, Toys, Accessories"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional category. Consider using tags instead.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter product description"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional detailed description of the product
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags Multi-Select */}
              <div>
                <Label className="text-sm font-medium">Tags</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Select tags for multi-category support
                </p>
                <div className="flex flex-wrap gap-2 p-4 border rounded-lg min-h-[60px]">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tags available. Create tags first.
                    </p>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        disabled={loading}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="autoship_eligible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={loading}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Autoship Eligible</FormLabel>
                      <FormDescription>
                        Enable this if customers can set up automatic recurring
                        orders for this product
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Product'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/products')}
                  disabled={loading}
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

