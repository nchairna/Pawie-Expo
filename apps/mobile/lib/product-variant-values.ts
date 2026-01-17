/**
 * Product variant value assignment functions for mobile catalog
 */

import { supabase } from './supabase';
import type { VariantValue, Product } from './types';

/**
 * Get variant values for a product
 */
export async function getProductVariantValues(
  productId: string
): Promise<VariantValue[]> {
  const { data, error } = await supabase
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
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to fetch product variant values: ${error.message}`);
  }

  // Extract variant_values from the join
  return (
    data
      ?.map((item: any) => item.variant_values)
      .filter((v: any) => v !== null) || []
  );
}

/**
 * Find product by variant combination
 * Returns product that has exactly these variant values
 */
export async function findProductByVariantCombination(
  familyId: string,
  variantValueIds: string[]
): Promise<Product | null> {
  if (variantValueIds.length === 0) {
    return null;
  }

  // Get all products in the family that are published
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      `
      *,
      product_variant_values!inner (
        variant_value_id
      )
    `
    )
    .eq('family_id', familyId)
    .eq('published', true);

  if (productsError) {
    throw new Error(`Failed to search products: ${productsError.message}`);
  }

  // Filter products that have exactly all the variant values
  const matchingProducts = (products || []).filter((product: any) => {
    const productValueIds = product.product_variant_values.map(
      (pv: any) => pv.variant_value_id
    );
    return (
      variantValueIds.length === productValueIds.length &&
      variantValueIds.every((id) => productValueIds.includes(id))
    );
  });

  return matchingProducts.length > 0 ? matchingProducts[0] : null;
}

/**
 * Check if a variant value has ANY products (for parent dimension filtering)
 * Returns true if at least one product exists with this value
 */
export async function hasProductsForValue(
  familyId: string,
  valueId: string
): Promise<boolean> {
  // Get all products in the family that have this variant value
  const { data: products, error } = await supabase
    .from('products')
    .select(
      `
      id,
      product_variant_values!inner (
        variant_value_id
      )
    `
    )
    .eq('family_id', familyId)
    .eq('published', true)
    .eq('product_variant_values.variant_value_id', valueId);

  if (error) {
    throw new Error(`Failed to check value availability: ${error.message}`);
  }

  return (products?.length ?? 0) > 0;
}

/**
 * Batch check availability for multiple values in a dimension
 * More efficient than checking one by one
 * Returns map of valueId -> isAvailable
 */
export async function checkValuesAvailability(
  familyId: string,
  dimensionId: string,
  valueIds: string[],
  currentSelections: Record<string, string> // dimensionId -> valueId (excluding current dimension)
): Promise<Record<string, boolean>> {
  if (valueIds.length === 0) {
    return {};
  }

  // Build the combination to check: current selections + each value
  const results: Record<string, boolean> = {};

  // Get all products in the family
  const { data: products, error } = await supabase
    .from('products')
    .select(
      `
      id,
      product_variant_values!inner (
        variant_value_id,
        variant_values!inner (
          dimension_id
        )
      )
    `
    )
    .eq('family_id', familyId)
    .eq('published', true);

  if (error) {
    throw new Error(`Failed to check values availability: ${error.message}`);
  }

  // For each value, check if a product exists with current selections + this value
  for (const valueId of valueIds) {
    const combinationToCheck = {
      ...currentSelections,
      [dimensionId]: valueId,
    };

    const combinationValueIds = Object.values(combinationToCheck);

    // Check if any product matches this combination
    const hasMatch = (products || []).some((product: any) => {
      const productValueIds = product.product_variant_values.map(
        (pv: any) => pv.variant_value_id
      );
      return (
        combinationValueIds.length === productValueIds.length &&
        combinationValueIds.every((id) => productValueIds.includes(id))
      );
    });

    results[valueId] = hasMatch;
  }

  return results;
}

/**
 * Find first available combination when switching dimensions
 * Automatically finds closest available option
 * Returns array of valueIds for available combination, or null if none found
 */
export async function findFirstAvailableCombination(
  familyId: string,
  changedDimensionId: string,
  newValueId: string,
  currentSelections: Record<string, string>
): Promise<string[] | null> {
  // Build new selections with changed dimension
  const newSelections = {
    ...currentSelections,
    [changedDimensionId]: newValueId,
  };

  // Get all products in the family
  const { data: products, error } = await supabase
    .from('products')
    .select(
      `
      id,
      product_variant_values!inner (
        variant_value_id
      )
    `
    )
    .eq('family_id', familyId)
    .eq('published', true);

  if (error) {
    throw new Error(`Failed to find available combination: ${error.message}`);
  }

  // Find products that match the new selection for the changed dimension
  const matchingProducts = (products || []).filter((product: any) => {
    const productValueIds = product.product_variant_values.map(
      (pv: any) => pv.variant_value_id
    );
    // Product must have the new value for changed dimension
    return productValueIds.includes(newValueId);
  });

  if (matchingProducts.length === 0) {
    return null; // No products with this value
  }

  // Try to find a product that matches as many current selections as possible
  // Priority: exact match > match most dimensions > any match
  const sortedProducts = matchingProducts.sort((a: any, b: any) => {
    const aValueIds = a.product_variant_values.map((pv: any) => pv.variant_value_id);
    const bValueIds = b.product_variant_values.map((pv: any) => pv.variant_value_id);
    
    const aMatches = Object.values(currentSelections).filter(id => 
      aValueIds.includes(id)
    ).length;
    const bMatches = Object.values(currentSelections).filter(id => 
      bValueIds.includes(id)
    ).length;
    
    return bMatches - aMatches; // Sort by most matches first
  });

  // Return the first available combination (most matching selections)
  const bestMatch = sortedProducts[0];
  if (bestMatch) {
    return bestMatch.product_variant_values.map((pv: any) => pv.variant_value_id);
  }

  return null;
}

