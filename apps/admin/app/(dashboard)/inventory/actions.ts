/**
 * Server Actions for Inventory mutations
 * Part 1.5: Server Actions for Inventory
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Validation schemas
const adjustInventorySchema = z.object({
  productId: z.string().uuid(),
  adjustment: z.number().int().refine((val) => val !== 0, {
    message: 'Adjustment must not be zero',
  }),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * Adjust inventory using database function
 * This ensures proper inventory tracking and movement logging
 *
 * The RPC function can either:
 * 1. Return a JSONB object with { success: false, error: '...', message: '...' }
 * 2. Throw an exception (RAISE EXCEPTION in the function)
 *
 * This action handles both cases properly.
 */
export async function adjustInventory(
  productId: string,
  adjustment: number,
  reason: string
): Promise<{ success: true } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = adjustInventorySchema.parse({
      productId,
      adjustment,
      reason,
    });

    // Get server-side Supabase client
    const supabase = await createClient();

    // Use the database RPC function for inventory adjustments
    // This ensures atomic operations and proper movement logging
    const { data, error } = await supabase.rpc('adjust_inventory', {
      p_product_id: validated.productId,
      p_adjustment: validated.adjustment,
      p_reason: validated.reason,
    });

    // Case 1: RPC threw an exception (caught by Supabase and returned as error)
    if (error) {
      const errorMessage = error.message || error.details || 'Failed to adjust inventory';
      return { error: errorMessage };
    }

    // Case 2: RPC returned successfully but with success: false
    // Handle RPC response - data is a JSONB object with success/error fields
    // Note: In some cases, Supabase may wrap the response in an array
    const result = Array.isArray(data) ? data[0] : data;

    // Check if result exists and has explicit success: false
    if (result && result.success === false) {
      const errorMessage = result.message || result.error || 'Failed to adjust inventory';
      return { error: errorMessage };
    }

    // Case 3: Success - result has success: true or no explicit failure
    // Revalidate inventory list and movement history pages
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${productId}/movements`);

    return { success: true };
  } catch (err: unknown) {
    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((issue) => issue.message).join(', ');
      return { error: messages || 'Validation error' };
    }

    // Handle standard errors
    if (err instanceof Error) {
      return { error: err.message };
    }

    return { error: 'Failed to adjust inventory' };
  }
}

/**
 * Add stock - convenience wrapper around adjustInventory for quick stock additions
 * Provides preset amounts for faster restocking
 */
export async function addStock(
  productId: string,
  quantity: number
): Promise<{ success: true } | { error: string }> {
  // Validate quantity is positive
  if (quantity <= 0) {
    return { error: 'Quantity must be positive' };
  }

  // Call adjustInventory with positive adjustment
  return adjustInventory(productId, quantity, 'restock');
}
