import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ProductDetailsManager } from '@/components/products/product-details-manager';

interface ProductDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { id: productId } = await params;
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    notFound();
  }

  return <ProductDetailsManager productId={productId} product={product} />;
}
