import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ProductInfoFormWrapper } from '@/components/products/product-info-form-wrapper';

// Dynamic data - 1 minute cache
export const revalidate = 60;

interface ProductInfoPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductInfoPage({ params }: ProductInfoPageProps) {
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

  return <ProductInfoFormWrapper product={product} />;
}
