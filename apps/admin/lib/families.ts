/**
 * Product family data access functions
 */

import { supabase } from './supabase';
import type { ProductFamily, FamilyWithDimensions } from './types';

/**
 * Get all product families
 */
export async function getFamilies(): Promise<ProductFamily[]> {
  const { data, error } = await supabase
    .from('product_families')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch families: ${error.message}`);
  }

  return data || [];
}

/**
 * Get single family with dimensions and values
 */
export async function getFamily(id: string): Promise<FamilyWithDimensions> {
  // Fetch family
  const { data: family, error: familyError } = await supabase
    .from('product_families')
    .select('*')
    .eq('id', id)
    .single();

  if (familyError) {
    if (familyError.code === 'PGRST116') {
      throw new Error('Family not found');
    }
    throw new Error(`Failed to fetch family: ${familyError.message}`);
  }

  // Fetch dimensions
  const { data: dimensions, error: dimensionsError } = await supabase
    .from('variant_dimensions')
    .select('*')
    .eq('family_id', id)
    .order('sort_order', { ascending: true });

  if (dimensionsError) {
    throw new Error(`Failed to fetch dimensions: ${dimensionsError.message}`);
  }

  // Fetch values for each dimension
  const dimensionsWithValues = await Promise.all(
    (dimensions || []).map(async (dimension) => {
      const { data: values, error: valuesError } = await supabase
        .from('variant_values')
        .select('*')
        .eq('dimension_id', dimension.id)
        .order('sort_order', { ascending: true });

      if (valuesError) {
        throw new Error(`Failed to fetch values: ${valuesError.message}`);
      }

      return {
        ...dimension,
        values: values || [],
      };
    })
  );

  return {
    ...family,
    dimensions: dimensionsWithValues,
  };
}

/**
 * Create new product family
 */
export async function createFamily(data: {
  name: string;
  description?: string | null;
}): Promise<ProductFamily> {
  const { data: family, error } = await supabase
    .from('product_families')
    .insert({
      name: data.name,
      description: data.description || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create family: ${error.message}`);
  }

  return family;
}

/**
 * Update product family
 */
export async function updateFamily(
  id: string,
  data: {
    name?: string;
    description?: string | null;
  }
): Promise<ProductFamily> {
  const { data: family, error } = await supabase
    .from('product_families')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update family: ${error.message}`);
  }

  return family;
}

/**
 * Delete product family
 * Note: This sets family_id to null on products (on delete set null)
 */
export async function deleteFamily(id: string): Promise<void> {
  // Check if family has products
  const { data: products, error: checkError } = await supabase
    .from('products')
    .select('id')
    .eq('family_id', id)
    .limit(1);

  if (checkError) {
    throw new Error(`Failed to check products: ${checkError.message}`);
  }

  if (products && products.length > 0) {
    throw new Error(
      'Cannot delete family with products. Remove products from family first or reassign them.'
    );
  }

  const { error } = await supabase.from('product_families').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete family: ${error.message}`);
  }
}







