'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  getProduct,
  updateProduct,
  togglePublish,
} from '@/lib/products';
import {
  getImages,
  uploadImage,
  deleteImage,
  reorderImages,
  setPrimaryImage,
  getImageUrl,
} from '@/lib/images';
import { getFamilies, getFamily } from '@/lib/families';
import {
  getProductVariantValues,
  setProductVariantValues as updateProductVariantValuesInDb,
} from '@/lib/product-variant-values';
import { getTags, getProductTags, setProductTags } from '@/lib/tags';
import type {
  Product,
  ProductImage,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  Star,
  X,
} from 'lucide-react';
import Link from 'next/link';

const updateProductSchema = z.object({
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

type UpdateProductFormValues = z.infer<typeof updateProductSchema>;

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);

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
        console.error('Failed to load families/tags:', err);
      }
    }
    fetchData();
  }, []);

  // Fetch product data
  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProduct(productId);
        setProduct(data);
        form.reset({
          name: data.name,
          family_id: data.family_id || '',
          category: data.category || '',
          description: data.description || '',
          autoship_eligible: data.autoship_eligible,
          base_price_idr: data.base_price_idr ?? null,
          sku: data.sku || null,
        });

        // Load family if assigned
        if (data.family_id) {
          handleFamilyChange(data.family_id);
        }

        // Load variant values
        const variantValues = await getProductVariantValues(productId);
        setProductVariantValues(variantValues);

        // Load family to map variant values to dimensions
        if (data.family_id) {
          const familyData = await getFamily(data.family_id);
          setSelectedFamily(familyData);
          const valueMap: Record<string, string> = {};
          variantValues.forEach((vv) => {
            // Find which dimension this value belongs to
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
        const productTagsData = await getProductTags(productId);
        setProductTagsState(productTagsData);
        setSelectedTagIds(productTagsData.map((t) => t.id));
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load product';
        setError(errorMessage);
        if (err.message === 'Product not found') {
          toast.error('Product not found');
          setTimeout(() => {
            router.push('/products');
          }, 2000);
        } else {
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId, form, router]);

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
    if (watchedFamilyId !== product?.family_id) {
      handleFamilyChange(watchedFamilyId);
    }
  }, [watchedFamilyId]);

  // Fetch images
  useEffect(() => {
    async function fetchImages() {
      if (!productId) return;
      try {
        setImagesLoading(true);
        const data = await getImages(productId);
        setImages(data);
      } catch (err: any) {
        toast.error(`Failed to load images: ${err.message}`);
      } finally {
        setImagesLoading(false);
      }
    }

    if (productId) {
      fetchImages();
    }
  }, [productId]);

  const handleSave = async (values: UpdateProductFormValues) => {
    if (!product) return;

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
      setProduct(updated);

      // Update variant values based on form's family_id and selected variant values
      // If family is selected in form and we have variant values, update them
      if (values.family_id && Object.keys(selectedVariantValues).length > 0) {
        const variantValueIds = Object.values(selectedVariantValues).filter(Boolean);
        try {
          await updateProductVariantValuesInDb(product.id, variantValueIds);
        } catch (variantError: any) {
          console.error('[handleSave] setProductVariantValues error:', variantError);
          throw variantError; // Re-throw to be caught by outer catch
        }
        const updatedValues = await getProductVariantValues(product.id);
        setProductVariantValues(updatedValues);
        // Also update selectedVariantValues state to reflect what was saved
        const valueMap: Record<string, string> = {};
        if (selectedFamily) {
          updatedValues.forEach((vv) => {
            const dimension = selectedFamily.dimensions.find((d) =>
              d.values.some((v) => v.id === vv.id)
            );
            if (dimension) {
              valueMap[dimension.id] = vv.id;
            }
          });
          setSelectedVariantValues(valueMap);
        }
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

      toast.success('Product updated successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update product';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!product) return;

    setTogglingPublish(true);
    try {
      const updated = await togglePublish(product.id, !product.published);
      setProduct(updated);
      toast.success(
        `Product ${!product.published ? 'published' : 'unpublished'} successfully`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle publish status';
      toast.error(errorMessage);
    } finally {
      setTogglingPublish(false);
    }
  };

  // Image management
  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product || !e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploadingImages(true);

    try {
      for (const file of files) {
        await uploadImage(product.id, file);
      }
      toast.success(`Successfully uploaded ${files.length} image(s)`);
      // Refresh images
      const data = await getImages(product.id);
      setImages(data);
      // Refresh product to get updated primary_image_path
      const updatedProduct = await getProduct(product.id);
      setProduct(updatedProduct);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (image: ProductImage) => {
    if (!product) return;
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setDeletingImageId(image.id);
      await deleteImage(image.id, product.id);
      toast.success('Image deleted successfully');
      // Refresh images
      const data = await getImages(product.id);
      setImages(data);
      // Refresh product to get updated primary_image_path
      const updatedProduct = await getProduct(product.id);
      setProduct(updatedProduct);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleSetPrimary = async (image: ProductImage) => {
    if (!product) return;

    try {
      await setPrimaryImage(image.id, product.id);
      toast.success('Primary image updated');
      // Refresh images
      const data = await getImages(product.id);
      setImages(data);
      // Refresh product to get updated primary_image_path
      const updatedProduct = await getProduct(product.id);
      setProduct(updatedProduct);
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary image');
    }
  };

  const handleMoveImage = async (image: ProductImage, direction: 'up' | 'down') => {
    if (!product || reorderingImages) return;

    const currentIndex = images.findIndex((img) => img.id === image.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === images.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newImages = [...images];
    const [moved] = newImages.splice(currentIndex, 1);
    newImages.splice(newIndex, 0, moved);

    // Update sort_order for all affected images
    const imageOrders = newImages.map((img, idx) => ({
      id: img.id,
      sort_order: idx,
    }));

    try {
      setReorderingImages(true);
      await reorderImages(product.id, imageOrders);
      // Refresh images
      const data = await getImages(product.id);
      setImages(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder images');
    } finally {
      setReorderingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push('/products')}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground mt-2">
              Edit product details, variants, and images
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Product Info</TabsTrigger>
          <TabsTrigger value="variants">Product Variants</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        {/* Product Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
              <CardDescription>
                Update product details and publish status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSave)}
                  className="space-y-6"
                >
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
                            // Handle sentinel value for "none"
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
                            disabled={saving || loadingFamily}
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
                            <FormDescription>
                              Stock Keeping Unit identifier
                            </FormDescription>
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
                            Enable this if customers can set up automatic
                            recurring orders for this product
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
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Images</CardTitle>
                  <CardDescription>
                    Upload and manage product images. The first image will be
                    set as primary automatically.
                  </CardDescription>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleUploadImages}
                    disabled={uploadingImages || !product}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    id="image-upload"
                  />
                  <Button
                    asChild
                    disabled={uploadingImages || !product}
                  >
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer disabled:cursor-not-allowed"
                    >
                      {uploadingImages ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Images
                        </>
                      )}
                    </label>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {imagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    No images yet. Upload your first product image.
                  </p>
                  <div className="relative inline-block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      onChange={handleUploadImages}
                      disabled={uploadingImages || !product}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      id="image-upload-empty"
                    />
                    <Button
                      variant="outline"
                      asChild
                      disabled={uploadingImages || !product}
                    >
                      <label
                        htmlFor="image-upload-empty"
                        className="cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Images
                      </label>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative group border rounded-lg overflow-hidden bg-muted"
                    >
                      <div className="aspect-square relative">
                        <img
                          src={getImageUrl(image.path)}
                          alt={image.alt_text || product?.name || 'Product image'}
                          className="w-full h-full object-cover"
                        />
                        {image.is_primary && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Primary
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleSetPrimary(image)}
                            disabled={image.is_primary}
                            title="Set as primary"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                image.is_primary ? 'fill-current' : ''
                              }`}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleMoveImage(image, 'up')}
                            disabled={index === 0 || reorderingImages}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleMoveImage(image, 'down')}
                            disabled={index === images.length - 1 || reorderingImages}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDeleteImage(image)}
                            disabled={deletingImageId === image.id}
                            title="Delete"
                          >
                            {deletingImageId === image.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        Order: {image.sort_order + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

