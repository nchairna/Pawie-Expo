/**
 * Product data access functions for mobile catalog
 * Only returns published products
 */

import { supabase } from './supabase';
import type { Product, ProductWithDetails } from './types';
import { getImages } from './images';
import { getProductVariantValues } from './product-variant-values';
import { getProductTags } from './tags';
import { getFamily } from './families';

/**
 * Get all published products with pagination
 * Note: For search functionality, use searchProducts() instead
 */
export async function getProducts(options?: {
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, primary_image_path, autoship_eligible, published, base_price_idr, sku')
    .eq('published', true)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

/**
 * Search published products using Postgres full-text search
 * @param query - Search query string
 * @param options - Pagination options
 * @returns Array of products matching the search query, ordered by relevance
 */
export async function searchProducts(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Product[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  // Trim and validate query
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    // If query is empty, return empty array
    return [];
  }

  // Call Postgres search function via RPC
  const { data, error } = await supabase.rpc('search_products', {
    search_query: trimmedQuery,
    result_limit: limit,
    result_offset: offset,
  });

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  // Remove relevance field from response (not part of Product type)
  return (data || []).map(({ relevance, ...product }) => product);
}

/**
 * Get single published product by ID
 * Returns 404 error if product not found or not published
 */
export async function getProduct(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('id, family_id, name, description, category, published, autoship_eligible, primary_image_path, base_price_idr, sku, created_at, updated_at')
    .eq('id', id)
    .eq('published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Product not found or not published');
    }
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  return data;
}

/**
 * Get product with all details (images, variant values, tags, family)
 * Price and SKU are stored directly on the product
 */
export async function getProductWithDetails(
  id: string
): Promise<ProductWithDetails> {
  // First get the product to check if it has a family_id
  const product = await getProduct(id);

  // Fetch all related data in parallel
  const [images, variantValues, tags, family] = await Promise.all([
    getImages(id),
    getProductVariantValues(id),
    getProductTags(id),
    product.family_id ? getFamily(product.family_id) : Promise.resolve(null),
  ]);

  return {
    ...product,
    images,
    variant_values: variantValues,
    tags,
    family: family || undefined,
  };
}

