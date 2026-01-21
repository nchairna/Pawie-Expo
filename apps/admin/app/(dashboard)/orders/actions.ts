/**
 * Server Actions for Order mutations
 * Part 1.5: Server Actions for Orders
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Validation schemas
const updateOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]),
});

/**
 * Update order status using database function
 * This ensures proper status transitions and logging
 */
export async function updateOrderStatus(
  id: string,
  status: string
): Promise<{ success: true } | { error: string }> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate inputs
    const validated = updateOrderStatusSchema.parse({ id, status });

    // Get server-side Supabase client
    const supabase = await createClient();

    // Use the database RPC function for status updates
    // This ensures proper validation and status transition logic
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: validated.id,
      p_new_status: validated.status,
    });

    if (error) {
      console.error('Error updating order status:', error);
      return { error: error.message };
    }

    if (!data || !data.success) {
      return { error: data?.error || 'Failed to update order status' };
    }

    // Revalidate orders list and order detail page
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message || 'Validation error' };
    }
    console.error('Error in updateOrderStatus:', err);
    return { error: err instanceof Error ? err.message : 'Failed to update order status' };
  }
}
