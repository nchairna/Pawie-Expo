/**
 * TypeScript types for Phase 2C - Mobile Catalog
 * Extended with Product Families & Variant Dimensions (Phase 2B.11)
 */

export interface Product {
  id: string;
  family_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  published: boolean;
  autoship_eligible: boolean;
  primary_image_path: string | null;
  base_price_idr: number | null;
  sku: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  path: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

// Phase 2B.11: Product Families & Variant Dimensions
export interface ProductFamily {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface VariantDimension {
  id: string;
  family_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface VariantValue {
  id: string;
  dimension_id: string;
  value: string;
  sort_order: number;
  created_at: string;
}

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

// Helper types
export interface ProductWithDetails extends Product {
  images: ProductImage[];
  variant_values: VariantValue[];
  tags: ProductTag[];
  family?: ProductFamilyWithDimensions;
}

export interface ProductFamilyWithDimensions extends ProductFamily {
  dimensions: (VariantDimension & {
    values: VariantValue[];
  })[];
}

export interface ProductWithVariantValues extends Product {
  variant_values: VariantValue[];
}

// Phase 3: Pricing Types
export interface PriceQuote {
  base_price_idr: number;
  final_price_idr: number;
  discount_total_idr: number;
  discounts_applied: {
    discount_id: string;
    name: string;
    type: string;
    value: number;
    amount: number;
  }[];
  line_total_idr: number;
}