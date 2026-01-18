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

// Phase 4: Order & Address Types
export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  address_line: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  created_at: string;
}

export interface AddressInput {
  label: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
}

export interface Order {
  id: string;
  status: string;
  source: string;
  subtotal_idr: number;
  discount_total_idr: number;
  total_idr: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_base_price_idr: number;
  unit_final_price_idr: number;
  discount_total_idr: number;
  product?: Product;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  address?: Address;
}

export interface OrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
}

// Phase 5: Autoship Types
export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  age: number | null;
  weight: number | null;
  activity_level: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Autoship {
  id: string;
  product_id: string;
  quantity: number;
  frequency_weeks: number;
  next_run_at: string;
  status: 'active' | 'paused' | 'cancelled';
  pet_id: string | null;
  created_at: string;
  // Joined data
  product?: Product;
  pet?: Pet;
}

export interface AutoshipRun {
  id: string;
  scheduled_at: string;
  executed_at: string | null;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  order_id: string | null;
}

export interface AutoshipWithRuns extends Autoship {
  runs: AutoshipRun[];
}

export interface AutoshipResult {
  success: boolean;
  autoship_id?: string;
  error?: string;
  next_run_at?: string;
  new_next_run_at?: string;
  skipped_date?: string;
}