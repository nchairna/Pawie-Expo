/**
 * Server-side product data access functions
 * For use in Server Components and Server Actions only
 */

import { createClient } from './supabase-server';
import type { Product, ProductWithVariantValues, PaginatedResponse } from './types';

export interface GetProductsOptions {
  page?: number;
  limit?: number;
  search?: string;
  familyId?: string;
  published?: boolean;
  tags?: string[];
}

/**
 * Get products with server-side pagination and filtering
 * Returns paginated response with products and metadata
 */
export async function getProducts(
  options?: GetProductsOptions
): Promise<PaginatedResponse<Product>> {
  const supabase = await createClient();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;

  // Build query with count - select only needed columns for list view
  let query = supabase
    .from('products')
    .select(
      'id, name, sku, base_price_idr, published, primary_image_path, family_id, updated_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false });

  // Apply filters
  if (options?.search) {
    query = query.or(
      `name.ilike.%${options.search}%,sku.ilike.%${options.search}%`
    );
  }

  if (options?.familyId) {
    query = query.eq('family_id', options.familyId);
  }

  if (options?.published !== undefined) {
    query = query.eq('published', options.published);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  // Map data to Product type with default values for unselected fields
  const products: Product[] = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    base_price_idr: row.base_price_idr,
    published: row.published,
    primary_image_path: row.primary_image_path,
    family_id: row.family_id,
    updated_at: row.updated_at,
    // Default values for fields not selected in list query
    detail_template_id: null,
    description: null,
    category: null,
    autoship_eligible: false,
    created_at: row.updated_at || '',
  }));

  return {
    data: products,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
    currentPage: page,
    limit,
  };
}

/**
 * Get single product by ID (server-side)
 * Uses .single() for optimized single-row query
 */
export async function getProduct(id: string): Promise<Product> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, description, category, sku, base_price_idr, published, autoship_eligible, primary_image_path, family_id, detail_template_id, created_at, updated_at'
    )
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Product not found');
    }
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  return data;
}

/**
 * Get product with variant values (server-side)
 */
export async function getProductWithVariantValues(
  id: string
): Promise<ProductWithVariantValues> {
  const supabase = await createClient();

  const product = await getProduct(id);

  // Fetch variant values
  const { data: assignments, error: assignmentsError } = await supabase
    .from('product_variant_values')
    .select(
      `
      variant_value_id,
      variant_values (
        id,
        dimension_id,
        value,
        sort_order,
        created_at
      )
    `
    )
    .eq('product_id', id);

  if (assignmentsError) {
    throw new Error(
      `Failed to fetch variant values: ${assignmentsError.message}`
    );
  }

  const variant_values =
    assignments
      ?.map((item: any) => item.variant_values)
      .filter((v: any) => v !== null) || [];

  return {
    ...product,
    variant_values,
  };
}

/**
 * Get products by family (server-side)
 */
export async function getProductsByFamily(
  familyId: string,
  options?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<Product>> {
  const supabase = await createClient();

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let query = supabase
    .from('products')
    .select(
      'id, name, sku, base_price_idr, published, primary_image_path, family_id, updated_at',
      { count: 'exact' }
    )
    .eq('family_id', familyId)
    .order('name', { ascending: true });

  if (limit) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch products by family: ${error.message}`);
  }

  // Map data to Product type with default values for unselected fields
  const products: Product[] = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    base_price_idr: row.base_price_idr,
    published: row.published,
    primary_image_path: row.primary_image_path,
    family_id: row.family_id,
    updated_at: row.updated_at,
    detail_template_id: null,
    description: null,
    category: null,
    autoship_eligible: false,
    created_at: row.updated_at || '',
  }));

  return {
    data: products,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
    currentPage: Math.floor(offset / limit) + 1,
    limit,
  };
}

/**
 * Search products with full-text search (server-side)
 */
export async function searchProducts(
  searchTerm: string,
  options?: {
    page?: number;
    limit?: number;
    published?: boolean;
  }
): Promise<PaginatedResponse<Product>> {
  const supabase = await createClient();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('products')
    .select(
      'id, name, sku, base_price_idr, published, primary_image_path, family_id, updated_at',
      { count: 'exact' }
    )
    .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
    .order('updated_at', { ascending: false });

  if (options?.published !== undefined) {
    query = query.eq('published', options.published);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  // Map data to Product type with default values for unselected fields
  const products: Product[] = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    base_price_idr: row.base_price_idr,
    published: row.published,
    primary_image_path: row.primary_image_path,
    family_id: row.family_id,
    updated_at: row.updated_at,
    detail_template_id: null,
    description: null,
    category: null,
    autoship_eligible: false,
    created_at: row.updated_at || '',
  }));

  return {
    data: products,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
    currentPage: page,
    limit,
  };
}
