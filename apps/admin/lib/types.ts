/**
 * TypeScript types for Phase 2B - Admin Catalog UI
 * Extended with Product Families & Variant Dimensions (Phase 2B.11)
 */

export interface Product {
  id: string; // uuid
  family_id: string | null; // Added in Phase 2B.11
  detail_template_id: string | null; // Added in Phase 4+ - product detail template
  name: string;
  description: string | null;
  category: string | null;
  published: boolean;
  autoship_eligible: boolean;
  primary_image_path: string | null;
  base_price_idr: number | null; // Added in Phase 2B.12 - price directly on product
  sku: string | null; // Added in Phase 2B.12 - SKU directly on product
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string; // uuid
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

export interface ProductWithVariantValues extends Product {
  variant_values: VariantValue[];
}

export interface FamilyWithDimensions extends ProductFamily {
  dimensions: (VariantDimension & {
    values: VariantValue[];
  })[];
}

export interface VariantDimensionWithValues extends VariantDimension {
  values: VariantValue[];
}

// Phase 3: Discount Types

export interface Discount {
  id: string;
  name: string;
  kind: 'promo' | 'autoship';
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  min_order_subtotal_idr: number | null;
  stack_policy: 'best_only' | 'stack';
  usage_limit: number | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface DiscountTarget {
  id: string;
  discount_id: string;
  product_id: string | null;
  applies_to_all_products: boolean;
  created_at: string;
}

export interface DiscountWithTargets extends Discount {
  targets: DiscountTarget[];
}

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

// Phase 4: Order Types

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  address_line: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  created_at: string;
}export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  source: 'one_time' | 'autoship';
  subtotal_idr: number;
  discount_total_idr: number;
  total_idr: number; // Note: database uses total_idr, not total_price_idr
  shipping_address_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: Profile;
  address?: Address;
}

export interface DiscountBreakdown {
  discount_id: string;
  name: string;
  type: string;
  value: number;
  amount: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_base_price_idr: number;
  unit_final_price_idr: number;
  discount_total_idr: number;
  discount_breakdown: DiscountBreakdown[] | null;
  created_at: string;
  // Joined data
  product?: Product;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface Inventory {
  id: string;
  product_id: string;
  stock_quantity: number;
  updated_at: string;
  // Joined data
  product?: Product;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  change_quantity: number;
  reason: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface InventoryWithProduct {
  id?: string | null;  // May be null if no inventory record exists
  product_id: string;
  stock_quantity: number;  // 0 if no inventory record
  updated_at?: string;
  product: Product;
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
  user_id: string;
  pet_id: string | null;
  product_id: string;
  quantity: number;
  frequency_weeks: number;
  next_run_at: string;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
  // Joined data
  user?: Profile;
  product?: Product;
  pet?: Pet;
}

export interface AutoshipRun {
  id: string;
  autoship_id: string;
  scheduled_at: string;
  executed_at: string | null;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  order_id: string | null;
  error_message: string | null;
  created_at: string;
  // Joined data
  order?: Order;
}

export interface AutoshipWithRuns extends Autoship {
  runs: AutoshipRun[];
}

export interface AutoshipStats {
  totalActive: number;
  totalPaused: number;
  dueToday: number;
  failedLastWeek: number;
}