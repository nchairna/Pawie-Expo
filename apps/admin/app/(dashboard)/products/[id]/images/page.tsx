import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ImagesManager } from '@/components/products/images-manager';

interface ProductImagesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductImagesPage({ params }: ProductImagesPageProps) {
  const { id: productId } = await params;
  const supabase = await createClient();

  // Verify product exists
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    notFound();
  }

  // Fetch product images
  const { data: images, error: imagesError } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (imagesError) {
    console.error('Error fetching images:', imagesError);
  }

  return <ImagesManager productId={productId} initialImages={images || []} />;
}
