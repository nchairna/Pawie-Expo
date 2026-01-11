/**
 * Discount data access functions for admin
 * Phase 3: Pricing Engine & Discounts
 */

import { supabase } from './supabase';
import type {
  Discount,
  DiscountTarget,
  DiscountWithTargets,
  PriceQuote,
} from './types';

/**
 * Get all discounts with pagination and filtering
 */
export async function getAllDiscounts(options?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  kind?: 'promo' | 'autoship';
}): Promise<Discount[]> {

  let query = supabase
    .from('discounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.active !== undefined) {
    query = query.eq('active', options.active);
  }

  if (options?.kind) {
    query = query.eq('kind', options.kind);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 100) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch discounts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get single discount by ID with targets
 */
export async function getDiscountById(
  id: string
): Promise<DiscountWithTargets | null> {

  // Fetch discount
  const { data: discount, error: discountError } = await supabase
    .from('discounts')
    .select('*')
    .eq('id', id)
    .single();

  if (discountError) {
    if (discountError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch discount: ${discountError.message}`);
  }

  // Fetch targets
  const { data: targets, error: targetsError } = await supabase
    .from('discount_targets')
    .select('*')
    .eq('discount_id', id);

  if (targetsError) {
    throw new Error(`Failed to fetch discount targets: ${targetsError.message}`);
  }

  return {
    ...discount,
    targets: targets || [],
  };
}

/**
 * Create new discount
 */
export async function createDiscount(data: {
  name: string;
  kind: 'promo' | 'autoship';
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  starts_at?: string;
  ends_at?: string;
  min_order_subtotal_idr?: number;
  stack_policy: 'best_only' | 'stack';
  usage_limit?: number;
}): Promise<Discount> {

  const { data: discount, error } = await supabase
    .from('discounts')
    .insert({
      name: data.name,
      kind: data.kind,
      discount_type: data.discount_type,
      value: data.value,
      active: data.active,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      min_order_subtotal_idr: data.min_order_subtotal_idr || null,
      stack_policy: data.stack_policy,
      usage_limit: data.usage_limit || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create discount: ${error.message}`);
  }

  return discount;
}

/**
 * Check if an active global autoship discount exists
 */
export async function hasActiveGlobalAutoshipDiscount(): Promise<boolean> {

  // Check for active autoship discount with applies_to_all_products = true
  const { data, error } = await supabase
    .from('discounts')
    .select('id')
    .eq('kind', 'autoship')
    .eq('active', true)
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to check for global autoship discount: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    return false;
  }

  // Check if any of these discounts have applies_to_all_products targets
  const discountIds = data.map((d) => d.id);
  const { data: targets, error: targetsError } = await supabase
    .from('discount_targets')
    .select('discount_id')
    .in('discount_id', discountIds)
    .eq('applies_to_all_products', true)
    .limit(1);

  if (targetsError) {
    throw new Error(
      `Failed to check discount targets: ${targetsError.message}`
    );
  }

  return (targets && targets.length > 0) || false;
}

/**
 * Update discount
 */
export async function updateDiscount(
  id: string,
  data: Partial<Discount>
): Promise<Discount> {

  const { data: discount, error } = await supabase
    .from('discounts')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update discount: ${error.message}`);
  }

  return discount;
}

/**
 * Delete discount (cascade will handle targets)
 */
export async function deleteDiscount(id: string): Promise<void> {

  const { error } = await supabase.from('discounts').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete discount: ${error.message}`);
  }
}

/**
 * Set discount targets (replaces existing targets)
 */
export async function setDiscountTargets(
  discountId: string,
  targets: {
    product_ids?: string[];
    applies_to_all_products?: boolean;
  }
): Promise<void> {

  // Delete existing targets
  const { error: deleteError } = await supabase
    .from('discount_targets')
    .delete()
    .eq('discount_id', discountId);

  if (deleteError) {
    throw new Error(
      `Failed to delete existing targets: ${deleteError.message}`
    );
  }

  // Insert new targets
  if (targets.applies_to_all_products) {
    // Single target for all products
    const { error: insertError } = await supabase
      .from('discount_targets')
      .insert({
        discount_id: discountId,
        applies_to_all_products: true,
        product_id: null,
      });

    if (insertError) {
      throw new Error(
        `Failed to create all-products target: ${insertError.message}`
      );
    }
  } else if (targets.product_ids && targets.product_ids.length > 0) {
    // Multiple product-specific targets
    const targetRows = targets.product_ids.map((productId) => ({
      discount_id: discountId,
      product_id: productId,
      applies_to_all_products: false,
    }));

    const { error: insertError } = await supabase
      .from('discount_targets')
      .insert(targetRows);

    if (insertError) {
      throw new Error(
        `Failed to create product targets: ${insertError.message}`
      );
    }
  } else {
    throw new Error('At least one target must be specified');
  }
}

/**
 * Toggle discount active status
 */
export async function toggleDiscountActive(
  id: string,
  active: boolean
): Promise<void> {

  const { error } = await supabase
    .from('discounts')
    .update({
      active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to toggle discount active: ${error.message}`);
  }
}

/**
 * Preview pricing for a product
 * Calls the compute_product_price() RPC function
 */
export async function previewPricing(
  productId: string,
  isAutoship: boolean,
  quantity: number = 1
): Promise<PriceQuote> {

  const { data, error } = await supabase.rpc('compute_product_price', {
    p_product_id: productId,
    p_user_id: null,
    p_is_autoship: isAutoship,
    p_quantity: quantity,
    p_cart_total_idr: null,
    p_coupon_code: null,
  });

  if (error) {
    throw new Error(`Failed to compute price: ${error.message}`);
  }

  if (!data) {
    throw new Error('No price data returned');
  }

  return data as PriceQuote;
}
