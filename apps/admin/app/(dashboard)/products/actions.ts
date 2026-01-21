/**
 * Server Actions for Product mutations
 * Part 1.5: Server Actions for Products
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Validation schemas
const togglePublishSchema = z.object({
  id: z.string().uuid(),
  published: z.boolean(),
});

const deleteProductSchema = z.object({
  id: z.string().uuid(),
});

const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  autoship_eligible: z.boolean().optional(),
  base_price_idr: z.number().int().min(0, 'Price must be positive').nullable().optional(),
  sku: z.string().nullable().optional(),
  family_id: z.string().uuid().nullable().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  autoship_eligible: z.boolean().optional(),
  base_price_idr: z.number().int().min(0, 'Price must be positive').nullable().optional(),
  sku: z.string().nullable().optional(),
  family_id: z.string().uuid().nullable().optional(),
  variant_value_ids: z.array(z.string().uuid()).optional(),
});

// Bulk operation schemas
const bulkProductIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one product ID is required'),
});

const bulkAssignTagsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, 'At least one product ID is required'),
  tagIds: z.array(z.string().uuid()).min(1, 'At least one tag ID is required'),
});

/**
 * Toggle product publish status
 */
export async function togglePublishProduct(
  id: string,
  published: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = togglePublishSchema.parse({ id, published });

    // Get server-side Supabase client
    const supabase = await createClient();

    // Update product
    const { error } = await supabase
      .from('products')
      .update({
        published: validated.published,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.id);

    if (error) {
      console.error('Error toggling publish status:', error);
      return { error: error.message };
    }

    // Revalidate products list and product detail page
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in togglePublishProduct:', err);
    return { error: err instanceof Error ? err.message : 'Failed to toggle publish status' };
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = deleteProductSchema.parse({ id });

    // Get server-side Supabase client
    const supabase = await createClient();

    // Delete product (cascade will handle related records)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', validated.id);

    if (error) {
      console.error('Error deleting product:', error);
      return { error: error.message };
    }

    // Revalidate products list
    revalidatePath('/products');

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in deleteProduct:', err);
    return { error: err instanceof Error ? err.message : 'Failed to delete product' };
  }
}

/**
 * Update product details
 */
export async function updateProduct(
  data: {
    id: string;
    name?: string;
    category?: string | null;
    description?: string | null;
    autoship_eligible?: boolean;
    base_price_idr?: number | null;
    sku?: string | null;
    family_id?: string | null;
  }
): Promise<{ success: true } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = updateProductSchema.parse(data);

    // Get server-side Supabase client
    const supabase = await createClient();

    // Prepare update data (only include provided fields)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.autoship_eligible !== undefined) updateData.autoship_eligible = validated.autoship_eligible;
    if (validated.base_price_idr !== undefined) updateData.base_price_idr = validated.base_price_idr;
    if (validated.sku !== undefined) updateData.sku = validated.sku;
    if (validated.family_id !== undefined) updateData.family_id = validated.family_id;

    // Update product
    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', validated.id);

    if (error) {
      console.error('Error updating product:', error);
      return { error: error.message };
    }

    // Revalidate products list and product detail page
    revalidatePath('/products');
    revalidatePath(`/products/${validated.id}`);

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in updateProduct:', err);
    return { error: err instanceof Error ? err.message : 'Failed to update product' };
  }
}

/**
 * Create a new product
 */
export async function createProduct(
  data: {
    name: string;
    category?: string | null;
    description?: string | null;
    autoship_eligible?: boolean;
    base_price_idr?: number | null;
    sku?: string | null;
    family_id?: string | null;
    variant_value_ids?: string[];
  }
): Promise<{ success: true; productId: string } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = createProductSchema.parse(data);

    // Get server-side Supabase client
    const supabase = await createClient();

    // Create product (always unpublished initially)
    const { data: product, error: createError } = await supabase
      .from('products')
      .insert({
        name: validated.name,
        category: validated.category || null,
        description: validated.description || null,
        autoship_eligible: validated.autoship_eligible || false,
        base_price_idr: validated.base_price_idr ?? null,
        sku: validated.sku || null,
        family_id: validated.family_id || null,
        published: false, // Always unpublished on creation
      })
      .select('id')
      .single();

    if (createError || !product) {
      console.error('Error creating product:', createError);
      return { error: createError?.message || 'Failed to create product' };
    }

    // Assign variant values if provided
    if (validated.variant_value_ids && validated.variant_value_ids.length > 0) {
      const { error: assignmentError } = await supabase
        .from('product_variant_values')
        .insert(
          validated.variant_value_ids.map((variantValueId) => ({
            product_id: product.id,
            variant_value_id: variantValueId,
          }))
        );

      if (assignmentError) {
        // Clean up product if assignment fails
        await supabase.from('products').delete().eq('id', product.id);
        console.error('Error assigning variant values:', assignmentError);
        return { error: assignmentError.message };
      }
    }

    // Revalidate products list
    revalidatePath('/products');

    return { success: true, productId: product.id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in createProduct:', err);
    return { error: err instanceof Error ? err.message : 'Failed to create product' };
  }
}

/**
 * Bulk publish products
 */
export async function bulkPublishProducts(
  ids: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireAdmin();
    const validated = bulkProductIdsSchema.parse({ ids });

    const supabase = await createClient();

    const { error, count } = await supabase
      .from('products')
      .update({
        published: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', validated.ids);

    if (error) {
      console.error('Error bulk publishing products:', error);
      return { error: error.message };
    }

    revalidatePath('/products');

    return { success: true, count: count || validated.ids.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in bulkPublishProducts:', err);
    return { error: err instanceof Error ? err.message : 'Failed to publish products' };
  }
}

/**
 * Bulk unpublish products
 */
export async function bulkUnpublishProducts(
  ids: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireAdmin();
    const validated = bulkProductIdsSchema.parse({ ids });

    const supabase = await createClient();

    const { error, count } = await supabase
      .from('products')
      .update({
        published: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', validated.ids);

    if (error) {
      console.error('Error bulk unpublishing products:', error);
      return { error: error.message };
    }

    revalidatePath('/products');

    return { success: true, count: count || validated.ids.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in bulkUnpublishProducts:', err);
    return { error: err instanceof Error ? err.message : 'Failed to unpublish products' };
  }
}

/**
 * Bulk delete products
 */
export async function bulkDeleteProducts(
  ids: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireAdmin();
    const validated = bulkProductIdsSchema.parse({ ids });

    const supabase = await createClient();

    const { error, count } = await supabase
      .from('products')
      .delete()
      .in('id', validated.ids);

    if (error) {
      console.error('Error bulk deleting products:', error);
      return { error: error.message };
    }

    revalidatePath('/products');

    return { success: true, count: count || validated.ids.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in bulkDeleteProducts:', err);
    return { error: err instanceof Error ? err.message : 'Failed to delete products' };
  }
}

/**
 * Bulk assign tags to products
 */
export async function bulkAssignTags(
  productIds: string[],
  tagIds: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireAdmin();
    const validated = bulkAssignTagsSchema.parse({ productIds, tagIds });

    const supabase = await createClient();

    // Create all product-tag combinations
    const assignments = validated.productIds.flatMap((productId) =>
      validated.tagIds.map((tagId) => ({
        product_id: productId,
        tag_id: tagId,
      }))
    );

    // Use upsert to avoid duplicates (on conflict do nothing)
    const { error, count } = await supabase
      .from('product_tags')
      .upsert(assignments, { onConflict: 'product_id,tag_id', ignoreDuplicates: true });

    if (error) {
      console.error('Error bulk assigning tags:', error);
      return { error: error.message };
    }

    revalidatePath('/products');

    return { success: true, count: count || assignments.length };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in bulkAssignTags:', err);
    return { error: err instanceof Error ? err.message : 'Failed to assign tags' };
  }
}

/**
 * Bulk remove tags from products
 */
export async function bulkRemoveTags(
  productIds: string[],
  tagIds: string[]
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireAdmin();
    const validated = bulkAssignTagsSchema.parse({ productIds, tagIds });

    const supabase = await createClient();

    const { error, count } = await supabase
      .from('product_tags')
      .delete()
      .in('product_id', validated.productIds)
      .in('tag_id', validated.tagIds);

    if (error) {
      console.error('Error bulk removing tags:', error);
      return { error: error.message };
    }

    revalidatePath('/products');

    return { success: true, count: count || 0 };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in bulkRemoveTags:', err);
    return { error: err instanceof Error ? err.message : 'Failed to remove tags' };
  }
}
