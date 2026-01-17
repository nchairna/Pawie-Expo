/**
 * Product family data access functions for mobile catalog
 */

import { supabase } from './supabase';
import type {
  ProductFamily,
  ProductFamilyWithDimensions,
  VariantDimension,
  VariantValue,
  Product,
} from './types';

/**
 * Get family with dimensions and values
 */
export async function getFamily(
  id: string
): Promise<ProductFamilyWithDimensions | null> {
  // Get family
  const { data: family, error: familyError } = await supabase
    .from('product_families')
    .select('*')
    .eq('id', id)
    .single();

  if (familyError) {
    if (familyError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch family: ${familyError.message}`);
  }

  // Get dimensions
  const { data: dimensions, error: dimensionsError } = await supabase
    .from('variant_dimensions')
    .select('*')
    .eq('family_id', id)
    .order('sort_order', { ascending: true });

  if (dimensionsError) {
    throw new Error(`Failed to fetch dimensions: ${dimensionsError.message}`);
  }

  // Get values for each dimension
  const dimensionsWithValues = await Promise.all(
    (dimensions || []).map(async (dimension: VariantDimension) => {
      const { data: values, error: valuesError } = await supabase
        .from('variant_values')
        .select('*')
        .eq('dimension_id', dimension.id)
        .order('sort_order', { ascending: true });

      if (valuesError) {
        throw new Error(
          `Failed to fetch values for dimension: ${valuesError.message}`
        );
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
 * Get dimensions for a family with their values
 */
export async function getFamilyDimensions(
  familyId: string
): Promise<(VariantDimension & { values: VariantValue[] })[]> {
  // Query dimensions
  const { data: dimensions, error: dimensionsError } = await supabase
    .from('variant_dimensions')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true });

  if (dimensionsError) {
    throw new Error(`Failed to fetch dimensions: ${dimensionsError.message}`);
  }

  // For each dimension, fetch values
  const dimensionsWithValues = await Promise.all(
    (dimensions || []).map(async (dimension: VariantDimension) => {
      const { data: values, error: valuesError } = await supabase
        .from('variant_values')
        .select('*')
        .eq('dimension_id', dimension.id)
        .order('sort_order', { ascending: true });

      if (valuesError) {
        throw new Error(
          `Failed to fetch values for dimension: ${valuesError.message}`
        );
      }

      return {
        ...dimension,
        values: values || [],
      };
    })
  );

  return dimensionsWithValues;
}

/**
 * Get products in a family (minimal fields for navigation)
 */
export async function getProductsByFamily(
  familyId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, primary_image_path')
    .eq('family_id', familyId)
    .eq('published', true);

  if (error) {
    throw new Error(`Failed to fetch products by family: ${error.message}`);
  }

  return data || [];
}

