/**
 * Autoship data access layer for mobile app
 * Phase 5 - Autoship System
 */

import { supabase } from './supabase';
import type { Autoship, AutoshipWithRuns, AutoshipResult } from './types';

/**
 * Get current user's autoships
 */
export async function getUserAutoships(): Promise<Autoship[]> {
  const { data, error } = await supabase
    .from('autoships')
    .select(`
      *,
      product:products!autoships_product_id_fkey(
        id, name, sku, primary_image_path, base_price_idr, autoship_eligible
      ),
      pet:pets!autoships_pet_id_fkey(id, name, species)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching autoships:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get autoship by ID with recent runs
 */
export async function getAutoshipById(id: string): Promise<AutoshipWithRuns | null> {
  const { data: autoship, error: autoshipError } = await supabase
    .from('autoships')
    .select(`
      *,
      product:products!autoships_product_id_fkey(
        id, name, sku, primary_image_path, base_price_idr, autoship_eligible
      ),
      pet:pets!autoships_pet_id_fkey(id, name, species)
    `)
    .eq('id', id)
    .single();

  if (autoshipError || !autoship) {
    console.error('Error fetching autoship:', autoshipError);
    return null;
  }

  // Get recent runs (last 10)
  const { data: runs, error: runsError } = await supabase
    .from('autoship_runs')
    .select('*')
    .eq('autoship_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(10);

  if (runsError) {
    console.error('Error fetching autoship runs:', runsError);
  }

  return {
    ...autoship,
    runs: runs || [],
  };
}

/**
 * Create a new autoship subscription
 */
export async function createAutoship(params: {
  productId: string;
  quantity: number;
  frequencyWeeks: number;
  petId?: string;
  startDate?: string;
}): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('create_autoship', {
    p_product_id: params.productId,
    p_quantity: params.quantity,
    p_frequency_weeks: params.frequencyWeeks,
    p_pet_id: params.petId || null,
    p_start_date: params.startDate || null,
  });

  if (error) {
    console.error('Error creating autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to create autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
    next_run_at: data.next_run_at,
  };
}

/**
 * Update autoship quantity and/or frequency
 */
export async function updateAutoship(
  id: string,
  params: { quantity?: number; frequencyWeeks?: number }
): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('update_autoship', {
    p_autoship_id: id,
    p_quantity: params.quantity || null,
    p_frequency_weeks: params.frequencyWeeks || null,
  });

  if (error) {
    console.error('Error updating autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to update autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
    new_next_run_at: data.new_next_run_at,
  };
}

/**
 * Skip the next delivery
 */
export async function skipNextAutoship(id: string): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('skip_next_autoship', {
    p_autoship_id: id,
  });

  if (error) {
    console.error('Error skipping autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to skip autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
    skipped_date: data.skipped_date,
    new_next_run_at: data.new_next_run_at,
  };
}

/**
 * Pause an autoship
 */
export async function pauseAutoship(id: string): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('pause_autoship', {
    p_autoship_id: id,
  });

  if (error) {
    console.error('Error pausing autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to pause autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
  };
}

/**
 * Resume a paused autoship
 */
export async function resumeAutoship(id: string): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('resume_autoship', {
    p_autoship_id: id,
    p_next_run_at: null, // Let function calculate
  });

  if (error) {
    console.error('Error resuming autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to resume autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
    next_run_at: data.next_run_at,
  };
}

/**
 * Cancel an autoship permanently
 */
export async function cancelAutoship(id: string): Promise<AutoshipResult> {
  const { data, error } = await supabase.rpc('cancel_autoship', {
    p_autoship_id: id,
  });

  if (error) {
    console.error('Error cancelling autoship:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Failed to cancel autoship',
    };
  }

  return {
    success: true,
    autoship_id: data.autoship_id,
  };
}

/**
 * Chewy-style: Create autoship with immediate first order
 * Used during checkout when user selects "Subscribe & Save"
 */
export async function createAutoshipWithOrder(params: {
  productId: string;
  quantity: number;
  frequencyWeeks: number;
  addressId: string;
  petId?: string;
}): Promise<{
  success: boolean;
  autoship_id?: string;
  order_id?: string;
  next_run_at?: string;
  error?: string;
  message?: string;
}> {
  const { data, error } = await supabase.rpc('create_autoship_with_order', {
    p_product_id: params.productId,
    p_quantity: params.quantity,
    p_frequency_weeks: params.frequencyWeeks,
    p_address_id: params.addressId,
    p_pet_id: params.petId || null,
  });

  if (error) {
    console.error('[createAutoshipWithOrder] RPC error:', error);
    return {
      success: false,
      error: 'RPC_ERROR',
      message: error.message,
    };
  }

  console.log('[createAutoshipWithOrder] RPC response:', JSON.stringify(data, null, 2));

  // Handle case where data might be null or the response structure is different
  if (!data) {
    console.error('[createAutoshipWithOrder] No data returned from RPC');
    return {
      success: false,
      error: 'NO_DATA',
      message: 'No data returned from server',
    };
  }

  return data as {
    success: boolean;
    autoship_id?: string;
    order_id?: string;
    next_run_at?: string;
    error?: string;
    message?: string;
  };
}
