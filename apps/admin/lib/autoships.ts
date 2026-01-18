/**
 * Autoship data access layer for admin app
 * Phase 5 - Autoship System
 */

import { createClient } from '@/lib/supabase-server';
import type { Autoship, AutoshipWithRuns, AutoshipRun, AutoshipStats } from './types';

/**
 * Get all autoships with filtering and pagination
 */
export async function getAllAutoships(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  userId?: string;
  productId?: string;
}): Promise<Autoship[]> {
  const supabase = await createClient();

  let query = supabase
    .from('autoships')
    .select(`
      *,
      user:profiles!autoships_user_id_fkey(id, email, full_name, role),
      product:products!autoships_product_id_fkey(id, name, sku, primary_image_path, base_price_idr),
      pet:pets!autoships_pet_id_fkey(id, name, species)
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options?.productId) {
    query = query.eq('product_id', options.productId);
  }

  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching autoships:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get autoship by ID with runs history
 */
export async function getAutoshipById(id: string): Promise<AutoshipWithRuns | null> {
  const supabase = await createClient();

  const { data: autoship, error: autoshipError } = await supabase
    .from('autoships')
    .select(`
      *,
      user:profiles!autoships_user_id_fkey(id, email, full_name, role),
      product:products!autoships_product_id_fkey(id, name, sku, primary_image_path, base_price_idr),
      pet:pets!autoships_pet_id_fkey(id, name, species)
    `)
    .eq('id', id)
    .single();

  if (autoshipError || !autoship) {
    console.error('Error fetching autoship:', autoshipError);
    return null;
  }

  // Get runs for this autoship
  const { data: runs, error: runsError } = await supabase
    .from('autoship_runs')
    .select(`
      *,
      order:orders!autoship_runs_order_id_fkey(id, status, total_idr)
    `)
    .eq('autoship_id', id)
    .order('scheduled_at', { ascending: false });

  if (runsError) {
    console.error('Error fetching autoship runs:', runsError);
  }

  return {
    ...autoship,
    runs: runs || [],
  };
}

/**
 * Get autoship runs for an autoship
 */
export async function getAutoshipRuns(
  autoshipId: string,
  options?: { limit?: number; offset?: number }
): Promise<AutoshipRun[]> {
  const supabase = await createClient();

  let query = supabase
    .from('autoship_runs')
    .select(`
      *,
      order:orders!autoship_runs_order_id_fkey(id, status, total_idr)
    `)
    .eq('autoship_id', autoshipId)
    .order('scheduled_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching autoship runs:', error);
    throw error;
  }

  return data || [];
}

/**
 * Pause an autoship (admin)
 */
export async function pauseAutoship(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('pause_autoship', {
    p_autoship_id: id,
  });

  if (error) {
    console.error('Error pausing autoship:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Failed to pause autoship' };
  }

  return { success: true };
}

/**
 * Resume an autoship (admin)
 */
export async function resumeAutoship(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('resume_autoship', {
    p_autoship_id: id,
    p_next_run_at: null, // Let function calculate
  });

  if (error) {
    console.error('Error resuming autoship:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Failed to resume autoship' };
  }

  return { success: true };
}

/**
 * Cancel an autoship (admin)
 */
export async function cancelAutoship(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('cancel_autoship', {
    p_autoship_id: id,
  });

  if (error) {
    console.error('Error cancelling autoship:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Failed to cancel autoship' };
  }

  return { success: true };
}

/**
 * Get autoship statistics for dashboard
 */
export async function getAutoshipStats(): Promise<AutoshipStats> {
  const supabase = await createClient();

  // Get total active
  const { count: totalActive } = await supabase
    .from('autoships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Get total paused
  const { count: totalPaused } = await supabase
    .from('autoships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'paused');

  // Get due today
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const { count: dueToday } = await supabase
    .from('autoships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('next_run_at', today.toISOString());

  // Get failed last week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const { count: failedLastWeek } = await supabase
    .from('autoship_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', oneWeekAgo.toISOString());

  return {
    totalActive: totalActive || 0,
    totalPaused: totalPaused || 0,
    dueToday: dueToday || 0,
    failedLastWeek: failedLastWeek || 0,
  };
}
