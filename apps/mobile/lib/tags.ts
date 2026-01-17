/**
 * Product tag data access functions for mobile catalog
 */

import { supabase } from './supabase';
import type { ProductTag } from './types';
import type { Product } from './types';

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
 * Get all available tags (for filter UI)
 */
export async function getAllTags(): Promise<ProductTag[]> {
  const { data, error } = await supabase
    .from('product_tags')
    .select('id, name, slug, created_at')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }

  return data || [];
}

/**
 * Filter products by tags using Postgres function
 * Products must have ALL specified tags (AND logic)
 */
export async function filterProductsByTags(
  tagIds: string[],
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Product[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  // Call Postgres filter function via RPC
  const { data, error } = await supabase.rpc('filter_products_by_tags', {
    tag_ids: tagIds.length > 0 ? tagIds : null,
    result_limit: limit,
    result_offset: offset,
  });

  if (error) {
    throw new Error(`Failed to filter products by tags: ${error.message}`);
  }

  return data || [];
}

