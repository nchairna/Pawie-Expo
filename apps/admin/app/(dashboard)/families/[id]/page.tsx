'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  getFamily,
  updateFamily,
  deleteFamily,
} from '@/lib/families';

import {
  getDimensionsWithValues,
  createDimension,
  updateDimension,
  deleteDimension,
  createValue,
  updateValue,
  deleteValue,
} from '@/lib/variant-dimensions';
import { getProductsByFamily } from '@/lib/products';
import type {
  FamilyWithDimensions,
  VariantDimension,
  VariantValue,
  Product,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';

const updateFamilySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type UpdateFamilyFormValues = z.infer<typeof updateFamilySchema>;

const dimensionSchema = z.object({
  name: z.string().min(1, 'Dimension name is required'),
  sort_order: z.number().int().min(0),
});

const valueSchema = z.object({
  value: z.string().min(1, 'Value is required'),
  sort_order: z.number().int().min(0),
});

export default function EditFamilyPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = params.id as string;

  const [family, setFamily] = useState<FamilyWithDimensions | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dimension dialogs
  const [dimensionDialogOpen, setDimensionDialogOpen] = useState(false);
  const [editingDimension, setEditingDimension] = useState<VariantDimension | null>(null);
  const [deletingDimensionId, setDeletingDimensionId] = useState<string | null>(null);

  // Value dialogs
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [valueDimensionId, setValueDimensionId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<VariantValue | null>(null);
  const [deletingValueId, setDeletingValueId] = useState<string | null>(null);

  const form = useForm<UpdateFamilyFormValues>({
    resolver: zodResolver(updateFamilySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const dimensionForm = useForm<z.infer<typeof dimensionSchema>>({
    resolver: zodResolver(dimensionSchema),
    defaultValues: {
      name: '',
      sort_order: 0,
    },
  });

  const valueForm = useForm<z.infer<typeof valueSchema>>({
    resolver: zodResolver(valueSchema),
    defaultValues: {
      value: '',
      sort_order: 0,
    },
  });

  // Fetch family data
  useEffect(() => {
    async function fetchFamily() {
      try {
        setLoading(true);
        setError(null);
        const data = await getFamily(familyId);
        setFamily(data);
        form.reset({
          name: data.name,
          description: data.description || '',
        });
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load family';
        setError(errorMessage);
        if (err.message === 'Family not found') {
          toast.error('Family not found');
          setTimeout(() => {
            router.push('/families');
          }, 2000);
        } else {
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    if (familyId) {
      fetchFamily();
    }
  }, [familyId, form, router]);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      if (!familyId) return;
      try {
        const data = await getProductsByFamily(familyId);
        setProducts(data);
      } catch (err: any) {
        console.error('Failed to fetch products:', err);
      }
    }

    if (familyId) {
      fetchProducts();
    }
  }, [familyId]);

  const handleSave = async (values: UpdateFamilyFormValues) => {
    if (!family) return;

    setSaving(true);
    try {
      const updated = await updateFamily(family.id, {
        name: values.name,
        description: values.description || null,
      });
      setFamily({ ...family, ...updated });
      toast.success('Family updated successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update family';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!family) return;
    if (!confirm(`Are you sure you want to delete "${family.name}"?`)) {
      return;
    }

    try {
      await deleteFamily(family.id);
      toast.success('Family deleted successfully');
      router.push('/families');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete family');
    }
  };

  // Dimension management
  const handleOpenDimensionDialog = (dimension?: VariantDimension) => {
    if (dimension) {
      setEditingDimension(dimension);
      dimensionForm.reset({
        name: dimension.name,
        sort_order: dimension.sort_order,
      });
    } else {
      setEditingDimension(null);
      dimensionForm.reset({
        name: '',
        sort_order: family?.dimensions.length || 0,
      });
    }
    setDimensionDialogOpen(true);
  };

  const handleSubmitDimension = async (values: z.infer<typeof dimensionSchema>) => {
    if (!family) return;

    try {
      if (editingDimension) {
        await updateDimension(editingDimension.id, values);
        toast.success('Dimension updated successfully');
      } else {
        await createDimension({
          family_id: family.id,
          ...values,
        });
        toast.success('Dimension created successfully');
      }
      handleCloseDimensionDialog();
      // Refresh family data
      const data = await getFamily(family.id);
      setFamily(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save dimension');
    }
  };

  const handleCloseDimensionDialog = () => {
    setDimensionDialogOpen(false);
    setEditingDimension(null);
    dimensionForm.reset();
  };

  const handleDeleteDimension = async (dimension: VariantDimension) => {
    if (!confirm(`Are you sure you want to delete dimension "${dimension.name}"?`)) {
      return;
    }

    try {
      setDeletingDimensionId(dimension.id);
      await deleteDimension(dimension.id);
      toast.success('Dimension deleted successfully');
      if (family) {
        const data = await getFamily(family.id);
        setFamily(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete dimension');
    } finally {
      setDeletingDimensionId(null);
    }
  };

  // Value management
  const handleOpenValueDialog = (dimensionId: string, value?: VariantValue) => {
    setValueDimensionId(dimensionId);
    if (value) {
      setEditingValue(value);
      valueForm.reset({
        value: value.value,
        sort_order: value.sort_order,
      });
    } else {
      setEditingValue(null);
      const dimension = family?.dimensions.find((d) => d.id === dimensionId);
      valueForm.reset({
        value: '',
        sort_order: dimension?.values.length || 0,
      });
    }
    setValueDialogOpen(true);
  };

  const handleSubmitValue = async (values: z.infer<typeof valueSchema>) => {
    if (!valueDimensionId) return;

    try {
      if (editingValue) {
        await updateValue(editingValue.id, values);
        toast.success('Value updated successfully');
      } else {
        await createValue({
          dimension_id: valueDimensionId,
          ...values,
        });
        toast.success('Value created successfully');
      }
      handleCloseValueDialog();
      // Refresh family data
      if (family) {
        const data = await getFamily(family.id);
        setFamily(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save value');
    }
  };

  const handleCloseValueDialog = () => {
    setValueDialogOpen(false);
    setValueDimensionId(null);
    setEditingValue(null);
    valueForm.reset();
  };

  const handleDeleteValue = async (value: VariantValue) => {
    if (!confirm(`Are you sure you want to delete value "${value.value}"?`)) {
      return;
    }

    try {
      setDeletingValueId(value.id);
      await deleteValue(value.id);
      toast.success('Value deleted successfully');
      if (family) {
        const data = await getFamily(family.id);
        setFamily(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete value');
    } finally {
      setDeletingValueId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading family...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !family) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push('/families')}>
            Back to Families
          </Button>
        </div>
      </div>
    );
  }

  if (!family) {
    return null;
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <Link
          href="/families"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Families
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{family.name}</h1>
            <p className="text-muted-foreground mt-2">
              Manage family, variant dimensions, and values
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Family Info</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
        </TabsList>

        {/* Family Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Family Information</CardTitle>
              <CardDescription>
                Update family name and description
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
                        <FormLabel>Family Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter family name"
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Enter family description"
                            {...field}
                            disabled={saving}
                          />
                        </FormControl>
                        <FormMessage />
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
                      variant="destructive"
                      onClick={handleDeleteFamily}
                      disabled={saving}
                    >
                      Delete Family
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dimensions Tab */}
        <TabsContent value="dimensions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Variant Dimensions</CardTitle>
                  <CardDescription>
                    Define variant types for this family (e.g., "Flavor", "Size")
                  </CardDescription>
                </div>
                <Dialog
                  open={dimensionDialogOpen}
                  onOpenChange={setDimensionDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDimensionDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Dimension
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingDimension ? 'Edit Dimension' : 'Add Dimension'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingDimension
                          ? 'Update dimension details.'
                          : 'Add a new variant dimension to this family.'}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...dimensionForm}>
                      <form
                        onSubmit={dimensionForm.handleSubmit(handleSubmitDimension)}
                        className="space-y-4"
                      >
                        <FormField
                          control={dimensionForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dimension Name *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Flavor, Size"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={dimensionForm.control}
                          name="sort_order"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sort Order</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value) || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCloseDimensionDialog}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            {editingDimension ? 'Update' : 'Create'} Dimension
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {family.dimensions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    No dimensions yet. Add your first dimension.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {family.dimensions.map((dimension) => (
                    <Card key={dimension.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {dimension.name}
                            </CardTitle>
                            <CardDescription>
                              Sort Order: {dimension.sort_order}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Dialog
                              open={
                                valueDialogOpen &&
                                valueDimensionId === dimension.id
                              }
                              onOpenChange={(open) => {
                                if (!open) handleCloseValueDialog();
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenValueDialog(dimension.id)
                                  }
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Value
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    {editingValue ? 'Edit Value' : 'Add Value'}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {editingValue
                                      ? 'Update value details.'
                                      : `Add a new value to "${dimension.name}" dimension.`}
                                  </DialogDescription>
                                </DialogHeader>
                                <Form {...valueForm}>
                                  <form
                                    onSubmit={valueForm.handleSubmit(
                                      handleSubmitValue
                                    )}
                                    className="space-y-4"
                                  >
                                    <FormField
                                      control={valueForm.control}
                                      name="value"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Value *</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="e.g., Lamb, 2lb bag"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={valueForm.control}
                                      name="sort_order"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Sort Order</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              {...field}
                                              onChange={(e) =>
                                                field.onChange(
                                                  parseInt(e.target.value) || 0
                                                )
                                              }
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <DialogFooter>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCloseValueDialog}
                                      >
                                        Cancel
                                      </Button>
                                      <Button type="submit">
                                        {editingValue ? 'Update' : 'Create'} Value
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleOpenDimensionDialog(dimension)
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Dimension
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    handleDeleteDimension(dimension)
                                  }
                                  disabled={deletingDimensionId === dimension.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {deletingDimensionId === dimension.id
                                    ? 'Deleting...'
                                    : 'Delete Dimension'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {dimension.values.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No values yet. Add values to this dimension.
                          </p>
                        ) : (
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Value</TableHead>
                                  <TableHead>Sort Order</TableHead>
                                  <TableHead className="text-right">
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dimension.values.map((value) => (
                                  <TableRow key={value.id}>
                                    <TableCell className="font-medium">
                                      {value.value}
                                    </TableCell>
                                    <TableCell>{value.sort_order}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleOpenValueDialog(
                                                dimension.id,
                                                value
                                              )
                                            }
                                          >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() =>
                                              handleDeleteValue(value)
                                            }
                                            disabled={
                                              deletingValueId === value.id
                                            }
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {deletingValueId === value.id
                                              ? 'Deleting...'
                                              : 'Delete'}
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Products in Family</CardTitle>
              <CardDescription>
                All products assigned to this family
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    No products in this family yet.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/products/new')}
                  >
                    Create Product
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>
                            {product.published ? (
                              <span className="text-sm text-green-600">
                                Published
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Unpublished
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/products/${product.id}`);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}







