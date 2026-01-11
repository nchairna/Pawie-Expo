/**
 * Variant dimension and value data access functions
 */

import { supabase } from './supabase';
import type {
  VariantDimension,
  VariantValue,
  VariantDimensionWithValues,
} from './types';

/**
 * Get dimensions for a family
 */
export async function getDimensions(
  familyId: string
): Promise<VariantDimension[]> {
  const { data, error } = await supabase
    .from('variant_dimensions')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch dimensions: ${error.message}`);
  }

  return data || [];
}

/**
 * Get dimensions with their values
 */
export async function getDimensionsWithValues(
  familyId: string
): Promise<VariantDimensionWithValues[]> {
  const dimensions = await getDimensions(familyId);

  const dimensionsWithValues = await Promise.all(
    dimensions.map(async (dimension) => {
      const values = await getValues(dimension.id);
      return {
        ...dimension,
        values,
      };
    })
  );

  return dimensionsWithValues;
}

/**
 * Create dimension
 */
export async function createDimension(data: {
  family_id: string;
  name: string;
  sort_order?: number;
}): Promise<VariantDimension> {
  const { data: dimension, error } = await supabase
    .from('variant_dimensions')
    .insert({
      family_id: data.family_id,
      name: data.name,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create dimension: ${error.message}`);
  }

  return dimension;
}

/**
 * Update dimension
 */
export async function updateDimension(
  id: string,
  data: {
    name?: string;
    sort_order?: number;
  }
): Promise<VariantDimension> {
  const { data: dimension, error } = await supabase
    .from('variant_dimensions')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update dimension: ${error.message}`);
  }

  return dimension;
}

/**
 * Delete dimension
 * Note: This will cascade delete values and product assignments
 */
export async function deleteDimension(id: string): Promise<void> {
  // Check if any products have values from this dimension
  const { data: assignments, error: checkError } = await supabase
    .from('product_variant_values')
    .select('variant_value_id')
    .limit(1);

  if (checkError) {
    throw new Error(`Failed to check assignments: ${checkError.message}`);
  }

  if (assignments && assignments.length > 0) {
    // Check if any of these assignments are for values in this dimension
    const { data: values } = await supabase
      .from('variant_values')
      .select('id')
      .eq('dimension_id', id)
      .limit(1);

    if (values && values.length > 0) {
      throw new Error(
        'Cannot delete dimension with product assignments. Remove assignments first.'
      );
    }
  }

  const { error } = await supabase
    .from('variant_dimensions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete dimension: ${error.message}`);
  }
}

/**
 * Get values for a dimension
 */
export async function getValues(dimensionId: string): Promise<VariantValue[]> {
  const { data, error } = await supabase
    .from('variant_values')
    .select('*')
    .eq('dimension_id', dimensionId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch values: ${error.message}`);
  }

  return data || [];
}

/**
 * Create value
 */
export async function createValue(data: {
  dimension_id: string;
  value: string;
  sort_order?: number;
}): Promise<VariantValue> {
  const { data: variantValue, error } = await supabase
    .from('variant_values')
    .insert({
      dimension_id: data.dimension_id,
      value: data.value,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create value: ${error.message}`);
  }

  return variantValue;
}

/**
 * Update value
 */
export async function updateValue(
  id: string,
  data: {
    value?: string;
    sort_order?: number;
  }
): Promise<VariantValue> {
  const { data: variantValue, error } = await supabase
    .from('variant_values')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update value: ${error.message}`);
  }

  return variantValue;
}

/**
 * Delete value
 * Note: This will cascade delete product assignments
 */
export async function deleteValue(id: string): Promise<void> {
  const { error } = await supabase.from('variant_values').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete value: ${error.message}`);
  }
}







