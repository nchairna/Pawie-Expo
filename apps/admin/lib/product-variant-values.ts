/**
 * Product variant value assignment functions
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
 * Assign variant value to product
 */
export async function assignVariantValue(
  productId: string,
  variantValueId: string
): Promise<void> {
  const { error } = await supabase.from('product_variant_values').insert({
    product_id: productId,
    variant_value_id: variantValueId,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Variant value already assigned to this product');
    }
    throw new Error(`Failed to assign variant value: ${error.message}`);
  }
}

/**
 * Remove variant value from product
 */
export async function removeVariantValue(
  productId: string,
  variantValueId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_variant_values')
    .delete()
    .eq('product_id', productId)
    .eq('variant_value_id', variantValueId);

  if (error) {
    throw new Error(`Failed to remove variant value: ${error.message}`);
  }
}

/**
 * Set all variant values for a product (replace existing)
 */
export async function setProductVariantValues(
  productId: string,
  variantValueIds: string[]
): Promise<void> {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('product_variant_values')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Failed to clear existing assignments: ${deleteError.message}`);
  }

  // Insert new assignments
  if (variantValueIds.length > 0) {
    const assignments = variantValueIds.map((variantValueId) => ({
      product_id: productId,
      variant_value_id: variantValueId,
    }));

    const { error: insertError } = await supabase
      .from('product_variant_values')
      .insert(assignments);

    if (insertError) {
      throw new Error(`Failed to assign variant values: ${insertError.message}`);
    }
  }
}

/**
 * Find product by variant combination
 */
export async function findProductByVariantCombination(
  familyId: string,
  variantValueIds: string[]
): Promise<Product | null> {
  if (variantValueIds.length === 0) {
    return null;
  }

  // Find products in the family that have all the specified variant values
  const { data, error } = await supabase
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

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  // Filter products that have all the variant values
  const matchingProducts = (data || []).filter((product: any) => {
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
 * Get available variant combinations for a family
 */
export async function getAvailableVariantCombinations(
  familyId: string
): Promise<Array<{ product_id: string; variant_value_ids: string[] }>> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      product_variant_values (
        variant_value_id
      )
    `
    )
    .eq('family_id', familyId)
    .eq('published', true);

  if (error) {
    throw new Error(`Failed to fetch combinations: ${error.message}`);
  }

  return (data || []).map((product: any) => ({
    product_id: product.id,
    variant_value_ids: product.product_variant_values.map(
      (pv: any) => pv.variant_value_id
    ),
  }));
}

