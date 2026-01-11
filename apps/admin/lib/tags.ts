/**
 * Product tag data access functions
 */

import { supabase } from './supabase';
import type { ProductTag } from './types';

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get all tags
 */
export async function getTags(): Promise<ProductTag[]> {
  const { data, error } = await supabase
    .from('product_tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }

  return data || [];
}

/**
 * Get single tag
 */
export async function getTag(id: string): Promise<ProductTag> {
  const { data, error } = await supabase
    .from('product_tags')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Tag not found');
    }
    throw new Error(`Failed to fetch tag: ${error.message}`);
  }

  return data;
}

/**
 * Create tag (auto-generates slug)
 */
export async function createTag(data: {
  name: string;
  slug?: string;
}): Promise<ProductTag> {
  const slug = data.slug || generateSlug(data.name);

  const { data: tag, error } = await supabase
    .from('product_tags')
    .insert({
      name: data.name,
      slug,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Tag name or slug already exists');
    }
    throw new Error(`Failed to create tag: ${error.message}`);
  }

  return tag;
}

/**
 * Update tag
 */
export async function updateTag(
  id: string,
  data: {
    name?: string;
    slug?: string;
  }
): Promise<ProductTag> {
  const updateData: any = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }

  const { data: tag, error } = await supabase
    .from('product_tags')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Tag name or slug already exists');
    }
    throw new Error(`Failed to update tag: ${error.message}`);
  }

  return tag;
}

/**
 * Delete tag (cascade deletes assignments)
 */
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('product_tags').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete tag: ${error.message}`);
  }
}

/**
 * Get tags for a product
 */
export async function getProductTags(productId: string): Promise<ProductTag[]> {
  const { data, error } = await supabase
    .from('product_tag_assignments')
    .select(
      `
      tag_id,
      product_tags (
        id,
        name,
        slug,
        created_at
      )
    `
    )
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to fetch product tags: ${error.message}`);
  }

  return (
    data
      ?.map((item: any) => item.product_tags)
      .filter((t: any) => t !== null) || []
  );
}

/**
 * Assign tag to product
 */
export async function assignTag(
  productId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase.from('product_tag_assignments').insert({
    product_id: productId,
    tag_id: tagId,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Tag already assigned to this product');
    }
    throw new Error(`Failed to assign tag: ${error.message}`);
  }
}

/**
 * Remove tag from product
 */
export async function removeTag(productId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('product_tag_assignments')
    .delete()
    .eq('product_id', productId)
    .eq('tag_id', tagId);

  if (error) {
    throw new Error(`Failed to remove tag: ${error.message}`);
  }
}

/**
 * Set all tags for a product (replace existing)
 */
export async function setProductTags(
  productId: string,
  tagIds: string[]
): Promise<void> {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('product_tag_assignments')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Failed to clear existing tag assignments: ${deleteError.message}`);
  }

  // Insert new assignments
  if (tagIds.length > 0) {
    const assignments = tagIds.map((tagId) => ({
      product_id: productId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from('product_tag_assignments')
      .insert(assignments);

    if (insertError) {
      throw new Error(`Failed to assign tags: ${insertError.message}`);
    }
  }
}







