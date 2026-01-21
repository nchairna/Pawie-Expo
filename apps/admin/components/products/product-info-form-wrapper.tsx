'use client';

import { useState } from 'react';
import type { Product } from '@/lib/types';
import { ProductInfoForm } from './product-info-form';

interface ProductInfoFormWrapperProps {
  product: Product;
}

export function ProductInfoFormWrapper({ product: initialProduct }: ProductInfoFormWrapperProps) {
  const [product, setProduct] = useState(initialProduct);

  return <ProductInfoForm product={product} onUpdate={setProduct} />;
}
