/**
 * Product image management functions
 */

import { supabase } from './supabase';
import type { ProductImage } from './types';

const BUCKET_NAME = 'product-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
 * Construct public image URL
 */
export function getImageUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

/**
 * Upload image to storage and create product_images row
 */
export async function uploadImage(
  productId: string,
  file: File
): Promise<ProductImage> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5MB limit.');
  }

  // Generate UUID for filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}/${crypto.randomUUID()}.${fileExt}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Get current max sort_order
  const { data: existingImages } = await supabase
    .from('product_images')
    .select('sort_order, is_primary')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const isFirstImage = !existingImages || existingImages.length === 0;
  const nextSortOrder = isFirstImage
    ? 0
    : (existingImages[0].sort_order ?? 0) + 1;

  // Create product_images row
  const { data: imageData, error: insertError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      path: fileName,
      sort_order: nextSortOrder,
      is_primary: isFirstImage,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up uploaded file if insert fails
    await supabase.storage.from(BUCKET_NAME).remove([fileName]);
    throw new Error(`Failed to create image record: ${insertError.message}`);
  }

  // If first image, update products.primary_image_path
  if (isFirstImage) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ primary_image_path: fileName })
      .eq('id', productId);

    if (updateError) {
      console.error('Failed to update primary_image_path:', updateError);
      // Don't throw - image is still created, just primary_image_path not set
    }
  }

  return imageData;
}

/**
 * Delete image from storage and database
 */
export async function deleteImage(
  id: string,
  productId: string
): Promise<void> {
  // Get image data first
  const { data: image, error: fetchError } = await supabase
    .from('product_images')
    .select('path, is_primary')
    .eq('id', id)
    .single();

  if (fetchError || !image) {
    throw new Error('Image not found');
  }

  const wasPrimary = image.is_primary;

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([image.path]);

  if (storageError) {
    console.error('Failed to delete from storage:', storageError);
    // Continue with DB deletion even if storage deletion fails
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to delete image: ${deleteError.message}`);
  }

  // If deleted image was primary, promote next image
  if (wasPrimary) {
    const { data: nextImage } = await supabase
      .from('product_images')
      .select('id, path')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (nextImage) {
      // Set next image as primary
      await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', nextImage.id);

      await supabase
        .from('products')
        .update({ primary_image_path: nextImage.path })
        .eq('id', productId);
    } else {
      // No images left, clear primary_image_path
      await supabase
        .from('products')
        .update({ primary_image_path: null })
        .eq('id', productId);
    }
  }
}

/**
 * Reorder images by updating sort_order
 */
export async function reorderImages(
  productId: string,
  imageOrders: Array<{ id: string; sort_order: number }>
): Promise<void> {
  // Batch update sort_order for multiple images
  const updates = imageOrders.map(({ id, sort_order }) =>
    supabase
      .from('product_images')
      .update({ sort_order })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(
      `Failed to reorder images: ${errors[0].error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Set primary image
 */
export async function setPrimaryImage(
  imageId: string,
  productId: string
): Promise<void> {
  // Get image path
  const { data: image, error: fetchError } = await supabase
    .from('product_images')
    .select('path')
    .eq('id', imageId)
    .single();

  if (fetchError || !image) {
    throw new Error('Image not found');
  }

  // Set all images for this product to is_primary: false
  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId);

  if (clearError) {
    throw new Error(`Failed to clear primary flags: ${clearError.message}`);
  }

  // Set selected image to is_primary: true
  const { error: setError } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);

  if (setError) {
    throw new Error(`Failed to set primary image: ${setError.message}`);
  }

  // Update products.primary_image_path
  const { error: updateError } = await supabase
    .from('products')
    .update({ primary_image_path: image.path })
    .eq('id', productId);

  if (updateError) {
    throw new Error(`Failed to update primary_image_path: ${updateError.message}`);
  }
}

