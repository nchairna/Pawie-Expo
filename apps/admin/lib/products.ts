/**
 * Product data access functions for admin catalog
 */

import { supabase } from './supabase';
import type { Product, ProductWithVariantValues } from './types';

/**
 * Get all products for list page
 */
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, published, updated_at, primary_image_path, family_id, base_price_idr, sku')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

/**
 * Get single product by ID
 */
export async function getProduct(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
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
 * Get product with variant values
 */
export async function getProductWithVariantValues(
  id: string
): Promise<ProductWithVariantValues> {
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
 * Create new product
 * Always creates with published: false
 */
export async function createProduct(product: {
  name: string;
  family_id?: string | null;
  category?: string | null;
  description?: string | null;
  autoship_eligible?: boolean;
  base_price_idr?: number | null;
  sku?: string | null;
  variant_value_ids?: string[];
}): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      family_id: product.family_id || null,
      category: product.category || null,
      description: product.description || null,
      autoship_eligible: product.autoship_eligible || false,
      base_price_idr: product.base_price_idr ?? null,
      sku: product.sku || null,
      published: false, // Always unpublished on creation
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  // Assign variant values if provided
  if (product.variant_value_ids && product.variant_value_ids.length > 0) {
    const { error: assignmentError } = await supabase
      .from('product_variant_values')
      .insert(
        product.variant_value_ids.map((variantValueId) => ({
          product_id: data.id,
          variant_value_id: variantValueId,
        }))
      );

    if (assignmentError) {
      // Clean up product if assignment fails
      await supabase.from('products').delete().eq('id', data.id);
      throw new Error(
        `Failed to assign variant values: ${assignmentError.message}`
      );
    }
  }

  return data;
}

/**
 * Update product fields
 */
export async function updateProduct(
  id: string,
  updates: {
    name?: string;
    family_id?: string | null;
    category?: string | null;
    description?: string | null;
    autoship_eligible?: boolean;
    base_price_idr?: number | null;
    sku?: string | null;
  }
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }

  return data;
}

/**
 * Get products by family
 */
export async function getProductsByFamily(
  familyId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('family_id', familyId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch products by family: ${error.message}`);
  }

  return data || [];
}

/**
 * Get related products (other products in same family)
 */
export async function getRelatedProducts(
  productId: string
): Promise<Product[]> {
  // Get current product's family_id
  const product = await getProduct(productId);

  if (!product.family_id) {
    return [];
  }

  // Get other products in same family
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('family_id', product.family_id)
    .neq('id', productId)
    .eq('published', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch related products: ${error.message}`);
  }

  return data || [];
}

/**
 * Toggle publish status
 */
export async function togglePublish(
  id: string,
  published: boolean
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to toggle publish: ${error.message}`);
  }

  return data;
}

/**
 * Delete product (cascade will handle variants/images)
 */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}

