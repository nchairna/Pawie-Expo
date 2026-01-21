import { ReactNode, Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { ProductTabs } from '@/components/products/product-tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

async function ProductHeader({ productId }: { productId: string }) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from('products')
    .select('id, name, published')
    .eq('id', productId)
    .single();

  if (!product) {
    return (
      <div>
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold">Product Not Found</h1>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground mt-2">
            Edit product details, variants, images, and content sections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              product.published
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
            }`}
          >
            {product.published ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductHeaderSkeleton() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-96 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export default async function ProductEditLayout({
  children,
  params,
}: ProductLayoutProps) {
  const { id: productId } = await params;

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <Suspense fallback={<ProductHeaderSkeleton />}>
          <ProductHeader productId={productId} />
        </Suspense>
      </div>

      <ProductTabs productId={productId} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
