'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateProduct, togglePublish } from '@/lib/products';
import { getFamilies, getFamily } from '@/lib/families';
import {
  getProductVariantValues,
  setProductVariantValues as updateProductVariantValuesInDb,
} from '@/lib/product-variant-values';
import { getTags, getProductTags, setProductTags } from '@/lib/tags';
import type {
  Product,
  ProductFamily,
  FamilyWithDimensions,
  VariantValue,
  ProductTag,
} from '@/lib/types';
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
import { Loader2 } from 'lucide-react';

const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  family_id: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  autoship_eligible: z.boolean(),
  base_price_idr: z
    .number()
    .int('Price must be an integer')
    .min(0, 'Price must be 0 or greater')
    .optional()
    .nullable(),
  sku: z.string().optional().nullable(),
});

type UpdateProductFormValues = z.infer<typeof updateProductSchema>;

interface ProductInfoFormProps {
  product: Product;
  onUpdate: (product: Product) => void;
}

export function ProductInfoForm({ product, onUpdate }: ProductInfoFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);

  // Family and variant values
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<FamilyWithDimensions | null>(null);
  const [productVariantValues, setProductVariantValues] = useState<VariantValue[]>([]);
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, string>>({});
  const [loadingFamily, setLoadingFamily] = useState(false);

  // Tags
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [productTags, setProductTagsState] = useState<ProductTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const form = useForm<UpdateProductFormValues>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: {
      name: product.name,
      family_id: product.family_id || '',
      category: product.category || '',
      description: product.description || '',
      autoship_eligible: product.autoship_eligible,
      base_price_idr: product.base_price_idr ?? null,
      sku: product.sku || null,
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
        console.error('Failed to load families/tags:', err);
      }
    }
    fetchData();
  }, []);

  // Load product's variant values and tags
  useEffect(() => {
    async function loadProductData() {
      try {
        // Load variant values
        const variantValues = await getProductVariantValues(product.id);
        setProductVariantValues(variantValues);

        // Load family if assigned
        if (product.family_id) {
          const familyData = await getFamily(product.family_id);
          setSelectedFamily(familyData);
          const valueMap: Record<string, string> = {};
          variantValues.forEach((vv) => {
            const dimension = familyData.dimensions.find((d) =>
              d.values.some((v) => v.id === vv.id)
            );
            if (dimension) {
              valueMap[dimension.id] = vv.id;
            }
          });
          setSelectedVariantValues(valueMap);
        }

        // Load tags
        const productTagsData = await getProductTags(product.id);
        setProductTagsState(productTagsData);
        setSelectedTagIds(productTagsData.map((t) => t.id));
      } catch (err: any) {
        console.error('Failed to load product data:', err);
      }
    }
    loadProductData();
  }, [product.id, product.family_id]);

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

      // Map existing variant values to dimensions
      if (productVariantValues.length > 0) {
        const valueMap: Record<string, string> = {};
        productVariantValues.forEach((vv) => {
          const dimension = familyData.dimensions.find((d) =>
            d.values.some((v) => v.id === vv.id)
          );
          if (dimension) {
            valueMap[dimension.id] = vv.id;
          }
        });
        setSelectedVariantValues(valueMap);
      }
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
    if (watchedFamilyId !== product.family_id) {
      handleFamilyChange(watchedFamilyId);
    }
  }, [watchedFamilyId]);

  const handleSave = async (values: UpdateProductFormValues) => {
    setSaving(true);
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
          setSaving(false);
          return;
        }
      }

      // Validate price and SKU if family is selected
      if (selectedFamily && (!values.base_price_idr || !values.sku)) {
        toast.error('Price and SKU are required for family-based products');
        setSaving(false);
        return;
      }

      const updated = await updateProduct(product.id, {
        name: values.name,
        family_id: values.family_id || null,
        category: values.category || null,
        description: values.description || null,
        autoship_eligible: values.autoship_eligible,
        base_price_idr: values.base_price_idr ?? null,
        sku: values.sku || null,
      });

      // Update variant values based on form's family_id and selected variant values
      if (values.family_id && Object.keys(selectedVariantValues).length > 0) {
        const variantValueIds = Object.values(selectedVariantValues).filter(Boolean);
        await updateProductVariantValuesInDb(product.id, variantValueIds);
        const updatedValues = await getProductVariantValues(product.id);
        setProductVariantValues(updatedValues);
      } else if (!values.family_id) {
        // Clear variant values if family is removed
        await updateProductVariantValuesInDb(product.id, []);
        setProductVariantValues([]);
        setSelectedVariantValues({});
      }

      // Update tags
      await setProductTags(product.id, selectedTagIds);
      const updatedTags = await getProductTags(product.id);
      setProductTagsState(updatedTags);

      onUpdate(updated);
      toast.success('Product updated successfully');
      router.refresh();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update product';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    setTogglingPublish(true);
    try {
      const updated = await togglePublish(product.id, !product.published);
      onUpdate(updated);
      toast.success(
        `Product ${!product.published ? 'published' : 'unpublished'} successfully`
      );
      router.refresh();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle publish status';
      toast.error(errorMessage);
    } finally {
      setTogglingPublish(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Information</CardTitle>
        <CardDescription>
          Update product details and publish status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
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
                      disabled={saving}
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
                      if (value === '__none__') {
                        field.onChange(undefined);
                      } else {
                        field.onChange(value);
                      }
                    }}
                    value={field.value || '__none__'}
                    disabled={saving || loadingFamily}
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
                  <Label className="text-base font-semibold">Variant Values</Label>
                  <p className="text-sm text-muted-foreground">
                    Select one value for each dimension
                  </p>
                </div>
                {selectedFamily.dimensions.map((dimension) => (
                  <div key={dimension.id}>
                    <Label className="text-sm font-medium">{dimension.name} *</Label>
                    <Select
                      value={selectedVariantValues[dimension.id] || ''}
                      onValueChange={(value) => {
                        setSelectedVariantValues((prev) => ({
                          ...prev,
                          [dimension.id]: value,
                        }));
                      }}
                      disabled={saving || loadingFamily}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue
                          placeholder={`Select ${dimension.name.toLowerCase()}`}
                        />
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

            {/* Price and SKU */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Price & SKU</Label>
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
                          disabled={saving}
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
                          disabled={saving}
                        />
                      </FormControl>
                      <FormDescription>Stock Keeping Unit identifier</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
                      disabled={saving}
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (Legacy)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Food, Toys, Accessories"
                      {...field}
                      disabled={saving}
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
                      disabled={saving}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional detailed description of the product
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      disabled={saving}
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

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button type="submit" disabled={saving}>
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
                variant={product.published ? 'default' : 'outline'}
                onClick={handleTogglePublish}
                disabled={togglingPublish}
              >
                {togglingPublish ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : product.published ? (
                  'Unpublish'
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
