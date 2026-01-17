/**
 * Pricing computation functions for mobile app
 * Phase 3: Pricing Engine & Discounts
 * 
 * All pricing is computed server-side via Postgres functions.
 * Clients never compute prices directly.
 */

import { supabase } from './supabase';
import type { PriceQuote } from './types';

/**
 * Compute price for a single product
 * 
 * @param productId - Product UUID
 * @param isAutoship - Whether this is an autoship purchase
 * @param quantity - Quantity (default: 1)
 * @param cartTotalIdr - Optional cart subtotal for min order threshold validation
 * @returns Price quote with breakdown
 */
export async function computeProductPrice(
  productId: string,
  isAutoship: boolean,
  quantity: number = 1,
  cartTotalIdr?: number
): Promise<PriceQuote> {
  const { data, error } = await supabase.rpc('compute_product_price', {
    p_product_id: productId,
    p_user_id: null, // User-specific discounts not implemented yet (Phase 6)
    p_is_autoship: isAutoship,
    p_quantity: quantity,
    p_cart_total_idr: cartTotalIdr || null,
    p_coupon_code: null, // Coupon codes not implemented yet (Phase 6)
  });

  if (error) {
    throw new Error(`Failed to compute product price: ${error.message}`);
  }

  if (!data) {
    throw new Error('No price data returned from server');
  }

  // Parse JSONB response
  return data as PriceQuote;
}

/**
 * Compute prices for multiple cart items (batch)
 * 
 * @param items - Array of cart items with productId and quantity
 * @param isAutoship - Whether this is an autoship purchase
 * @returns Array of price quotes (one per item)
 */
export async function computeCartPrices(
  items: { productId: string; quantity: number }[],
  isAutoship: boolean
): Promise<PriceQuote[]> {
  // For now, compute prices sequentially
  // Future optimization: batch RPC call if Supabase supports it
  const priceQuotes = await Promise.all(
    items.map((item) =>
      computeProductPrice(item.productId, isAutoship, item.quantity)
    )
  );

  return priceQuotes;
}
