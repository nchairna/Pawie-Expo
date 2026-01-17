import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { ProductImage } from './types';

/**
 * Get images for a product
 */
export async function getImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch images: ${error.message}`);
  }

  return data || [];
}

/**
 * Construct public URL for product image
 * Format: {EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/{path}
 */
export function getImageUrl(path: string): string {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    Constants.expoConfig?.extra?.supabaseUrl;

  if (!supabaseUrl) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL. Please check your environment variables.'
    );
  }

  // Ensure path doesn't start with a slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${supabaseUrl}/storage/v1/object/public/product-images/${cleanPath}`;
}

