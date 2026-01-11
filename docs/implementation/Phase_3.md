# Phase 3 — Pricing Engine & Discounts

**Product**: Pawie
**Phase**: 3
**Status**: In Progress - Backend Complete, Admin UI Complete (Part B Done + Enhancements), Mobile UI Next (Part C)
**Last Updated**: 2026-01-09 (Updated with schema fixes, UI enhancements, and new features)
**Estimated Duration**: 2 weeks

---

## 1. Goal

Implement a server-side pricing computation system with discount rules that:
- Computes final prices dynamically based on context (autoship, promotions)
- Never modifies base prices (immutable pricing principle)
- Supports stacking policies for multiple discounts
- Provides clear price breakdowns to users
- Enables admin to manage discount rules without touching product prices

**Key Principle**: Base prices are sacred. Discounts are computed at runtime and never overwrite `products.base_price_idr`.

**Autoship Discount Strategy (MVP)**:
- Implement **global autoship discount** (one discount applies to all autoship-eligible products)
- Example: "Save 10% on every autoship order"
- Product-level `autoship_eligible` flag controls subscription eligibility
- **Future Enhancement**: Product-specific autoship discounts can be added later without schema changes

---

## 2. Canonical References

This phase MUST align with:
- **Doc 03** — Data Model (discounts + discount_targets schema)
- **Doc 04** — API & Data Flow (pricing computation logic)
- **Doc 07** — Overall Plan (Phase 3 requirements)

**Conflict Resolution**: If code conflicts with these docs, documentation takes precedence.

---

## 3. Scope

### Included in Phase 3:

**Backend**:
- ✅ Discount schema validation (tables already exist from Phase 1) - **COMPLETE**
- ✅ Postgres function: `compute_product_price()` - core pricing logic - **COMPLETE**
- ✅ Postgres function: `find_applicable_discounts()` - discount finding - **COMPLETE**
- ✅ Postgres function: `apply_discount_stacking()` - stacking policy - **COMPLETE**
- ✅ Helper functions for discount validation - **COMPLETE**
- ✅ Test SQL scripts for pricing scenarios - **COMPLETE**

**Admin App**:
- ✅ Discount list page (`/discounts`) - **COMPLETE**
- ✅ Create discount page (`/discounts/new`) - **COMPLETE**
- ✅ Edit discount page (`/discounts/[id]`) - **COMPLETE**
- ✅ Discount targets management (product-specific, all products) - **COMPLETE**
- ✅ Autoship discount configuration - **COMPLETE**
- ✅ Pricing preview tool (compare one-time vs autoship) - **COMPLETE**
- ✅ Discount activation/deactivation toggle - **COMPLETE**
- ✅ Admin sidebar navigation - **COMPLETE** (New)
- ✅ Enhanced product selector component - **COMPLETE** (New - search, family filters)

**Mobile App**:
- Display computed prices on product list
- Display price breakdown on product detail
- Show autoship savings indicator
- Visual distinction between base and discounted prices
- Price computation on cart items (prep for Phase 4)

### Excluded (Future Phases):
- Order creation with pricing snapshots (Phase 4)
- Autoship execution (Phase 5)
- Cart management UI (Phase 4)
- Checkout flow (Phase 4)

---

## 4. Prerequisites

Before starting Phase 3, ensure:
- ✅ Phase 2 is 100% complete (catalog browsing working)
- ✅ Discount tables exist in database (`discounts`, `discount_targets`)
- ✅ Products table has `base_price_idr` column
- ✅ Admin and mobile apps can read products
- ✅ Authentication working (admin vs user roles)

---

## 5. Implementation Plan

### Part A: Backend Pricing Functions (Week 1, Days 1-3) ✅ **COMPLETE**

#### A.1 Core Pricing Function

**File**: `supabase/migrations/0015_pricing_functions.sql` ✅ **COMPLETE**

**Function**: `compute_product_price()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION compute_product_price(
  p_product_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_is_autoship boolean DEFAULT false,
  p_quantity integer DEFAULT 1,
  p_cart_total_idr integer DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- Returns:
-- {
--   "base_price_idr": 250000,
--   "final_price_idr": 225000,
--   "discount_total_idr": 25000,
--   "discounts_applied": [...],
--   "line_total_idr": 225000
-- }
$$;
```

**Logic Flow**:
1. Validate product exists and is published
2. Get base price from `products.base_price_idr`
3. Find applicable discounts using `find_applicable_discounts()`
4. Apply stacking policy (`best_only` or `stack`)
5. Compute discount amount
6. Calculate final price (never negative)
7. Return JSON breakdown

**Inputs**:
- `p_product_id` - Product to price
- `p_user_id` - For user-specific discounts (optional, Phase 6)
- `p_is_autoship` - Include autoship discount if true
- `p_quantity` - Quantity for line total calculation
- `p_cart_total_idr` - Cart subtotal for min order threshold validation
- `p_coupon_code` - Coupon validation (optional, Phase 6)

**Outputs** (JSONB):
- `base_price_idr` - Immutable base price
- `final_price_idr` - Price after discounts
- `discount_total_idr` - Total discount applied
- `discounts_applied` - Array of discount details
- `line_total_idr` - final_price × quantity

**Schema Qualification Fix** (2026-01-09):
- ✅ Functions updated with explicit `public.` schema prefix
- ✅ Migration `20260109050000_ensure_pricing_functions_exist.sql` created to ensure functions exist
- ✅ All function calls within functions use fully qualified names (`public.find_applicable_discounts`, `public.apply_discount_stacking`)
- ✅ `SET search_path = ''` added for security (prevents search path injection)

**Testing Checklist**:
- [x] Returns base price when no discounts apply
- [x] Applies percentage discounts correctly (10% off 100000 = 90000)
- [x] Applies fixed discounts correctly (5000 off 100000 = 95000)
- [x] Autoship discount applies only when `p_is_autoship = true`
- [x] Stacking policy `best_only` takes highest discount
- [x] Stacking policy `stack` combines discounts
- [x] Final price never goes negative
- [x] Respects `starts_at` and `ends_at` time windows
- [x] Respects `min_order_subtotal_idr` threshold
- [x] Returns empty discounts array when none applicable

---

#### A.2 Discount Finding Function

**File**: Same migration (`0015_pricing_functions.sql`) ✅ **COMPLETE**
**Additional Fix**: `supabase/migrations/20260109050000_ensure_pricing_functions_exist.sql` ✅ **CREATED**

**Function**: `find_applicable_discounts()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.find_applicable_discounts(
  p_product_id uuid,
  p_is_autoship boolean,
  p_cart_total_idr integer DEFAULT NULL
)
RETURNS TABLE (
  discount_id uuid,
  name text,
  kind text,
  discount_type text,
  value integer,
  stack_policy text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- Returns discounts that:
-- 1. Are active (active = true)
-- 2. Within time window (starts_at <= NOW() <= ends_at)
-- 3. Target this product OR applies_to_all_products = true
-- 4. Meet min_order_subtotal_idr if set
-- 5. Include autoship discounts only if p_is_autoship = true
$$;
```

**Logic**:
1. Filter by `active = true`
2. Filter by time window (`starts_at` and `ends_at`)
3. Filter by product targeting:
   - `discount_targets.product_id = p_product_id` OR
   - `discount_targets.applies_to_all_products = true`
4. Filter by autoship context:
   - If `kind = 'autoship'`, only include when `p_is_autoship = true`
   - If `kind = 'promo'`, always include
5. Filter by cart total threshold:
   - If `min_order_subtotal_idr` is set, require `p_cart_total_idr >= min_order_subtotal_idr`
6. Order by discount amount (descending) for `best_only` policy

**Testing Checklist**:
- [ ] Returns active discounts only
- [ ] Excludes expired discounts
- [ ] Excludes future discounts (starts_at > NOW())
- [ ] Returns product-specific discounts
- [ ] Returns all-products discounts
- [ ] Autoship discount only included when `p_is_autoship = true`
- [ ] Promo discounts always included
- [ ] Respects min order threshold
- [ ] Returns empty set when no discounts match

---

#### A.3 Discount Stacking Function

**File**: Same migration (`0015_pricing_functions.sql`) ✅ **COMPLETE**
**Additional Fix**: `supabase/migrations/20260109050000_ensure_pricing_functions_exist.sql` ✅ **CREATED**

**Function**: `apply_discount_stacking()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.apply_discount_stacking(
  p_base_price_idr integer,
  p_discounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
-- Takes array of discounts, applies stacking policy
-- Returns:
-- {
--   "final_price_idr": 225000,
--   "discount_total_idr": 25000,
--   "discounts_applied": [...]
-- }
$$;
```

**Logic**:
1. Group discounts by `stack_policy`
2. If any discount has `stack_policy = 'best_only'`:
   - Take highest discount only
3. If all have `stack_policy = 'stack'`:
   - Apply percentage discounts first (multiplicative)
   - Apply fixed discounts second (additive)
4. Ensure final price >= 0
5. Build discount breakdown array

**Stacking Rules**:
- **best_only**: Take single highest discount (ignore others)
- **stack**: Combine discounts (percentage first, then fixed)

**Examples**:
```sql
-- Example 1: best_only (10% promo vs 10% autoship)
-- Base: 100000, Discount A: 10% (10000), Discount B: 10% (10000)
-- Result: 90000 (one 10% discount applied)

-- Example 2: stack (10% autoship + 5000 fixed promo)
-- Base: 100000, Autoship: 10% (10000), Promo: 5000 fixed
-- Step 1: Apply 10% → 90000
-- Step 2: Apply 5000 → 85000
-- Result: 85000
```

**Testing Checklist**:
- [x] `best_only` takes highest discount
- [x] `stack` combines percentage + fixed correctly
- [x] Order of operations: percentage first, then fixed
- [x] Final price never negative
- [x] Discount breakdown accurate

---

#### A.4 Test Data and Validation

**File**: `supabase/migrations/0016_pricing_test_data.sql` ✅ **COMPLETE**

**Purpose**: Seed test discounts for development and validation

**Test Scenarios**:
1. **Global Autoship Discount** (10% off all autoship-eligible products)
   ```sql
   -- CRITICAL: Only ONE active global autoship discount should exist
   INSERT INTO discounts (name, kind, discount_type, value, active, stack_policy)
   VALUES ('Autoship 10% Off', 'autoship', 'percentage', 10, true, 'stack');

   INSERT INTO discount_targets (discount_id, applies_to_all_products)
   VALUES (discount_id, true);

   -- Note: This applies to ALL products where autoship_eligible = true
   ```

2. **Product-Specific Promo** (15% off specific product)
   ```sql
   INSERT INTO discounts (name, kind, discount_type, value, active, stack_policy)
   VALUES ('Royal Canin Sale', 'promo', 'percentage', 15, true, 'best_only');

   INSERT INTO discount_targets (discount_id, product_id)
   VALUES (discount_id, 'specific-product-id');
   ```

3. **Fixed Discount** (5000 IDR off)
   ```sql
   INSERT INTO discounts (name, kind, discount_type, value, active, stack_policy)
   VALUES ('5K Off', 'promo', 'fixed', 5000, true, 'stack');

   INSERT INTO discount_targets (discount_id, applies_to_all_products)
   VALUES (discount_id, true);
   ```

4. **Min Order Threshold** (10% off orders over 200000)
   ```sql
   INSERT INTO discounts (name, kind, discount_type, value, active, min_order_subtotal_idr, stack_policy)
   VALUES ('10% Off 200K+', 'promo', 'percentage', 10, true, 200000, 'best_only');
   ```

**Validation Queries**:
```sql
-- Test 1: One-time purchase (no autoship)
SELECT compute_product_price(
  'product-id',
  NULL,
  false,  -- not autoship
  1
);
-- Expected: Base price with promo discounts only

-- Test 2: Autoship purchase
SELECT compute_product_price(
  'product-id',
  NULL,
  true,  -- autoship
  1
);
-- Expected: Base price with autoship + promo discounts

-- Test 3: Min threshold not met
SELECT compute_product_price(
  'product-id',
  NULL,
  false,
  1,
  50000  -- cart total below threshold
);
-- Expected: Threshold-based discounts excluded

-- Test 4: Stacking
-- (Product with both percentage autoship and fixed promo)
-- Expected: Both discounts applied in correct order
```

**Testing Checklist**:
- [x] Test data inserts successfully
- [x] All 4 test scenarios return expected results
- [x] Pricing function handles edge cases (null inputs, negative prices)
- [x] Performance acceptable (< 100ms per call)

---

#### A.4 Schema Qualification Fix (2026-01-09) ✅ **COMPLETE**

**Issue**: Functions were not properly qualified with `public.` schema prefix, causing "function does not exist" errors when called from client code.

**Migration**: `supabase/migrations/20260109050000_ensure_pricing_functions_exist.sql` ✅ **CREATED**

**Fixes Applied**:
1. All functions now use explicit `public.` schema prefix:
   - `public.find_applicable_discounts()`
   - `public.apply_discount_stacking()`
   - `public.compute_product_price()`
2. Function calls within functions use fully qualified names:
   - `public.find_applicable_discounts()` called from `compute_product_price()`
   - `public.apply_discount_stacking()` called from `compute_product_price()`
3. Added `SET search_path = ''` for security (prevents search path injection attacks)
4. All table references fully qualified (`public.discounts`, `public.products`, etc.)

**Testing Checklist**:
- [x] Functions exist in public schema
- [x] Functions can be called from client code (Supabase RPC)
- [x] No "function does not exist" errors
- [x] Security: search_path injection prevented

---

### Part B: Admin Discount Management (Week 1, Days 4-5) ✅ **COMPLETE**

#### B.1 Data Access Layer ✅ **COMPLETE**

**File**: `apps/admin/lib/discounts.ts` ✅ **CREATED**

**Functions to Implement**:
```typescript
// List all discounts with pagination
export async function getAllDiscounts(options?: {
  limit?: number;
  offset?: number;
  active?: boolean;
}): Promise<Discount[]>

// Get single discount with targets
export async function getDiscountById(id: string): Promise<DiscountWithTargets | null>

// Create new discount
export async function createDiscount(data: {
  name: string;
  kind: 'promo' | 'autoship';
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  starts_at?: string;
  ends_at?: string;
  min_order_subtotal_idr?: number;
  stack_policy: 'best_only' | 'stack';
  usage_limit?: number;
}): Promise<Discount>

// Check if global autoship discount exists (for validation)
export async function hasActiveGlobalAutoshipDiscount(): Promise<boolean>

// Update discount
export async function updateDiscount(
  id: string,
  data: Partial<Discount>
): Promise<Discount>

// Delete discount
export async function deleteDiscount(id: string): Promise<void>

// Set discount targets
export async function setDiscountTargets(
  discountId: string,
  targets: {
    product_ids?: string[];
    applies_to_all_products?: boolean;
  }
): Promise<void>

// Toggle active status
export async function toggleDiscountActive(
  id: string,
  active: boolean
): Promise<void>

// Preview pricing for a product
export async function previewPricing(
  productId: string,
  isAutoship: boolean,
  quantity: number
): Promise<PriceQuote>
```

**Types** (`apps/admin/lib/types.ts`):
```typescript
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
```

**Testing Checklist**:
- [x] All CRUD operations work
- [x] RLS policies enforced (admin-only access) - **VERIFIED**: `discounts_admin_all` and `discount_targets_admin_all` policies exist, require `is_admin()`
- [x] Target assignment works for products and all-products
- [x] Preview pricing calls `compute_product_price()` correctly
- [x] Error handling for invalid inputs

---

#### B.2 Discount List Page ✅ **COMPLETE**

**File**: `apps/admin/app/discounts/page.tsx` ✅ **CREATED**

**Features**:
- Table view with columns:
  - Name
  - Kind (Promo / Autoship)
  - Type (Percentage / Fixed)
  - Value
  - Active toggle (inline)
  - Time window (starts_at - ends_at)
  - Targets (count or "All Products")
  - Actions (Edit, Delete)
- Filter by active status
- Filter by kind (promo, autoship)
- Search by name
- "Create Discount" button (top right)
- Empty state: "No discounts yet. Create your first discount."

**UI Components** (shadcn/ui):
- Table
- Badge (for kind, type)
- Switch (for active toggle)
- Button
- Input (search)
- Select (filters)

**Testing Checklist**:
- [x] List loads all discounts - **IMPLEMENTED**
- [x] Active toggle works (updates DB) - **IMPLEMENTED** (uses Switch component with toggleDiscountActive)
- [x] Filters work correctly - **IMPLEMENTED** (active status and kind filters)
- [x] Search filters by name - **IMPLEMENTED** (debounced search)
- [x] Empty state shows when no discounts - **IMPLEMENTED**
- [x] Delete confirmation dialog works - **IMPLEMENTED** (uses browser confirm)
- [x] Navigation to edit page works - **IMPLEMENTED** (click row or Edit button)

---

#### B.3 Create/Edit Discount Page ✅ **COMPLETE**

**File**: `apps/admin/app/discounts/[id]/page.tsx` (edit) ✅ **CREATED**
**File**: `apps/admin/app/discounts/new/page.tsx` (create) ✅ **CREATED**

**Form Fields**:
1. **Name** (text input, required)
2. **Kind** (select: Promo, Autoship)
   - **If Autoship selected**: Show warning if global autoship discount already exists
3. **Discount Type** (select: Percentage, Fixed)
4. **Value** (number input, required)
   - If percentage: 0-100
   - If fixed: 0-999999999
5. **Active** (switch, default true)
6. **Starts At** (datetime picker, optional)
   - **Note**: For autoship discounts, typically left empty (always active)
7. **Ends At** (datetime picker, optional)
   - **Note**: For autoship discounts, typically left empty (always active)
8. **Min Order Subtotal** (number input, optional)
   - **Note**: Not typically used for autoship discounts
9. **Stack Policy** (select: Best Only, Stack)
   - **Default for autoship**: "Stack" (allows stacking with promo discounts)
10. **Usage Limit** (number input, optional)
    - **Note**: Not used for autoship discounts (unlimited usage)
11. **Targets Section**:
    - **If Kind = "Promo"**: Radio: "Specific Products" vs "All Products"
      - If Specific Products: Enhanced ProductSelector component (see below)
      - If All Products: Show info message
    - **If Kind = "Autoship"**:
      - Auto-select "All Products" (default for MVP)
      - Show info: "This discount applies to all autoship-eligible products"
      - **Future**: Add option for specific products

**ProductSelector Component** (New - 2026-01-09):
- **File**: `apps/admin/components/product-selector.tsx` ✅ **CREATED**
- **Features**:
  - Search products by name (debounced)
  - Filter by product family
  - Bulk select/deselect all visible products
  - Clear list view with product names and families
  - Shows selected count
  - Responsive design
- **Usage**: Replaces simple chip list for better scalability
- **Props**:
  ```typescript
  interface ProductSelectorProps {
    products: Product[];
    families: ProductFamily[];
    selectedProductIds: string[];
    onSelectionChange: (ids: string[]) => void;
    disabled?: boolean;
  }
  ```

**Validation Rules**:
- Name required, max 255 chars
- Value required, must be positive
- If percentage: value <= 100
- Starts at must be before ends at (if both set)
- Min order subtotal must be positive if set
- At least one target required (product or all-products)
- **Autoship-specific validation**:
  - Only ONE active global autoship discount allowed (check before saving)
  - If creating autoship discount and one exists, show warning:
    - "A global autoship discount already exists. Deactivate it first or edit the existing one."
  - Autoship discounts must target "All Products" (MVP requirement)

**UI Flow**:
1. Fill basic discount info
2. Select targets (products or all)
3. Save button calls `createDiscount()` or `updateDiscount()`
4. Then calls `setDiscountTargets()`
5. Show success toast
6. Redirect to discount list

**Testing Checklist**:
- [x] Form validation works - **IMPLEMENTED** (zod schema with all validation rules)
- [x] Create promo discount works - **IMPLEMENTED**
- [x] Create autoship discount works - **IMPLEMENTED** (with validation warning)
- [x] Edit discount works - **IMPLEMENTED** (loads existing data, updates correctly)
- [x] Target assignment works (promo discounts) - **IMPLEMENTED** (multi-select product picker)
- [x] All-products toggle works (promo discounts) - **IMPLEMENTED** (radio selection)
- [x] Autoship discount auto-selects "All Products" - **IMPLEMENTED** (auto-set on kind change)
- [x] Validation prevents multiple active global autoship discounts - **IMPLEMENTED** (hasActiveGlobalAutoshipDiscount check)
- [x] Date pickers work - **IMPLEMENTED** (datetime-local inputs)
- [x] Success/error toasts show - **IMPLEMENTED** (sonner toast notifications)
- [x] Redirect works after save - **IMPLEMENTED** (redirects to list or edit page)

---

#### B.4 Pricing Preview Tool ✅ **COMPLETE**

**File**: `apps/admin/app/discounts/preview/page.tsx` ✅ **CREATED**

**Purpose**: Let admin test pricing scenarios before creating orders

**Features**:
- Product selector (dropdown with published products only)
- Quantity input (default 1)
- Cart Total input (optional, for testing min order threshold discounts)
- "One-Time Purchase" vs "Autoship" toggle
- "Calculate Price" button
- Results display:
  - Base price
  - Discounts applied (list with amounts)
  - Final price
  - Total savings (with percentage)
  - Line total (quantity × final price)
- **Enhanced Error Handling** (2026-01-09):
  - Clear error messages for unpublished products
  - Clear error messages for products without base price
  - Helpful guidance on why pricing might fail
- **Automatic Discount Application**:
  - Note displayed explaining that all active, applicable discounts are automatically applied
  - No manual discount selection needed
  - Discounts are found based on product targeting, time windows, and context

**Example UI**:
```
┌─────────────────────────────────────────┐
│ Pricing Preview Tool                    │
├─────────────────────────────────────────┤
│ Product: [Select Product ▼]             │
│ Quantity: [1]                           │
│ Purchase Type: ( ) One-Time (•) Autoship│
│                                         │
│ [Calculate Price]                       │
│                                         │
│ Results:                                │
│ Base Price: Rp 250,000                  │
│                                         │
│ Discounts Applied:                      │
│ • Autoship 10% Off: -Rp 25,000          │
│                                         │
│ Final Price: Rp 225,000                 │
│ Total Savings: Rp 25,000 (10%)          │
│ Line Total: Rp 225,000 (qty: 1)         │
└─────────────────────────────────────────┘
```

**Testing Checklist**:
- [x] Product selection works - **IMPLEMENTED** (only shows published products with base price)
- [x] Calculation calls `compute_product_price()` correctly - **IMPLEMENTED** (calls RPC directly via client)
- [x] One-time vs autoship pricing differs correctly - **IMPLEMENTED** (toggle switch)
- [x] Discount breakdown shows all applied discounts - **IMPLEMENTED** (detailed breakdown with amounts)
- [x] Formatting is readable (IDR currency) - **IMPLEMENTED** (Intl.NumberFormat with IDR)
- [x] Edge cases handled (no discounts, multiple discounts) - **IMPLEMENTED** (shows appropriate messages)
- [x] Cart total input works for min order threshold testing - **IMPLEMENTED**
- [x] Error messages are clear and helpful - **IMPLEMENTED**
- [x] Only valid products shown in selector - **IMPLEMENTED** (published + has base_price_idr)

---

#### B.5 Admin Navigation Sidebar ✅ **COMPLETE** (New - 2026-01-09)

**Files**:
- `apps/admin/components/admin-sidebar.tsx` ✅ **CREATED**
- `apps/admin/components/admin-layout.tsx` ✅ **CREATED**
- `apps/admin/components/layout-wrapper.tsx` ✅ **CREATED**

**Features**:
- Responsive sidebar navigation (desktop: fixed, mobile: Sheet overlay)
- Navigation links:
  - Dashboard
  - Products
  - Discounts
  - Families
  - Tags
- Active link highlighting based on current pathname
- User email display
- Logout functionality
- Conditional rendering (hidden on login, register, forbidden pages)

**Implementation**:
- Uses `usePathname()` from Next.js for active state
- Desktop: Fixed 256px sidebar with `md:ml-64` main content offset
- Mobile: Hamburger menu opens Sheet component
- Layout wrapper conditionally applies AdminLayout based on route

**Testing Checklist**:
- [x] Sidebar shows on admin pages
- [x] Sidebar hidden on auth pages (login, register, forbidden)
- [x] Active link highlighting works
- [x] Mobile menu works (Sheet opens/closes)
- [x] Navigation links work correctly
- [x] Logout works

---

### Part C: Mobile Price Display (Week 2, Days 1-2)

#### C.1 Data Access Layer

**File**: `apps/mobile/lib/pricing.ts`

**Functions to Implement**:
```typescript
// Compute price for a product
export async function computeProductPrice(
  productId: string,
  isAutoship: boolean,
  quantity: number = 1,
  cartTotalIdr?: number
): Promise<PriceQuote>

// Compute prices for cart items (batch)
export async function computeCartPrices(
  items: { productId: string; quantity: number }[],
  isAutoship: boolean
): Promise<PriceQuote[]>
```

**Implementation**:
- Call `compute_product_price()` RPC function
- Parse JSONB response
- Handle errors gracefully

**Testing Checklist**:
- [ ] Single product pricing works
- [ ] Batch cart pricing works
- [ ] Error handling works
- [ ] Loading states handled

---

#### C.2 Product List Price Display

**File**: `apps/mobile/app/(tabs)/shop.tsx` (modify existing)

**Changes**:
1. For each product, call `computeProductPrice()` with `isAutoship: false`
2. Display both base and final prices if different:
   ```
   Rp 250,000  ← base price (strikethrough if discounted)
   Rp 225,000  ← final price (bold, green)
   ```
3. Show discount badge if `discount_total_idr > 0`:
   ```
   🏷️ 10% OFF
   ```
4. Show autoship savings indicator:
   ```
   💰 Save 10% with Autoship
   ```

**Performance Optimization**:
- Batch price computation for visible products
- Cache results for 5 minutes
- Show base price immediately, load final price async

**Testing Checklist**:
- [ ] Prices load correctly
- [ ] Discount badge shows when applicable
- [ ] Autoship savings indicator shows
- [ ] Performance acceptable (not blocking UI)
- [ ] Cache works correctly

---

#### C.3 Product Detail Price Breakdown

**File**: `apps/mobile/app/product/[id].tsx` (modify existing)

**Changes**:
1. Add price section with breakdown:
   ```
   ┌────────────────────────────────────┐
   │ One-Time Purchase                  │
   │ Base Price: Rp 250,000             │
   │ Promo Discount: -Rp 37,500 (15%)   │
   │ Final Price: Rp 212,500            │
   └────────────────────────────────────┘

   ┌────────────────────────────────────┐
   │ Autoship (Save 10% every order!)   │
   │ Base Price: Rp 250,000             │
   │ Autoship Discount: -Rp 25,000      │
   │ Promo Discount: -Rp 33,750         │
   │ Final Price: Rp 191,250            │
   │ Total Savings: Rp 58,750 (23%)     │
   └────────────────────────────────────┘
   ```

2. Add toggle to switch between one-time and autoship pricing
3. Show all applied discounts with amounts
4. Highlight savings with color

**UI Components**:
- Card for each pricing option
- Badge for discount labels
- Toggle for one-time vs autoship
- Text formatting for currency

**Testing Checklist**:
- [ ] Price breakdown displays correctly
- [ ] One-time vs autoship toggle works
- [ ] All discounts show in breakdown
- [ ] Savings calculation accurate
- [ ] Currency formatting correct (IDR)
- [ ] Visual hierarchy clear (base vs final price)

---

#### C.4 Autoship Savings Indicator

**File**: `apps/mobile/components/AutoshipSavingsCard.tsx` (new)

**Purpose**: Promote autoship by showing savings

**Props**:
```typescript
interface AutoshipSavingsCardProps {
  basePrice: number;
  autoshipPrice: number;
  savingsPercentage: number;
  savingsAmount: number;
}
```

**UI**:
```
┌─────────────────────────────────────────┐
│ 💰 Save with Autoship!                  │
│ Get this item delivered automatically   │
│ and save Rp 25,000 (10%) every order.   │
│                                         │
│ [Enroll in Autoship →]                  │
└─────────────────────────────────────────┘
```

**Testing Checklist**:
- [ ] Card renders correctly
- [ ] Savings calculation accurate
- [ ] Button navigation works (to autoship enrollment - Phase 5)
- [ ] Visual design matches app theme

---

### Part D: Testing & Validation (Week 2, Days 3-5)

#### D.1 Backend Function Tests

**File**: `supabase/tests/pricing_tests.sql` (optional, for documentation)

**Test Scenarios**:
1. **No discounts**: Returns base price
2. **Single percentage discount**: Calculates correctly
3. **Single fixed discount**: Calculates correctly
4. **Multiple discounts (best_only)**: Takes highest
5. **Multiple discounts (stack)**: Combines correctly
6. **Autoship discount**: Only applies when `is_autoship = true`
7. **Time-bound discount**: Respects starts_at and ends_at
8. **Min order threshold**: Only applies when threshold met
9. **Negative price prevention**: Final price never < 0
10. **Performance**: Completes in < 100ms

**How to Run**:
```sql
-- Run each test scenario
SELECT * FROM test_pricing_scenario_1();
SELECT * FROM test_pricing_scenario_2();
-- etc.
```

**Acceptance Criteria**:
- [x] All 10 test scenarios pass ✅ **COMPLETE**
- [x] No SQL errors ✅ **COMPLETE**
- [x] Performance target met ✅ **COMPLETE** (3.6ms, well under 100ms)

---

#### D.2 Admin UI Tests

**Manual Testing Checklist**:

**Discount List Page**:
- [ ] Create first discount (empty state → list)
- [ ] Toggle discount active/inactive
- [ ] Filter by kind (promo, autoship)
- [ ] Search by name
- [ ] Edit discount (navigate to edit page)
- [ ] Delete discount (confirmation dialog)

**Create Discount Page**:
- [ ] Create promo discount (percentage)
- [ ] Create promo discount (fixed)
- [ ] Create global autoship discount (percentage, all products)
- [ ] Validation: Name required
- [ ] Validation: Value must be positive
- [ ] Validation: Percentage <= 100
- [ ] Validation: Starts at before ends at
- [ ] Validation: Only one active global autoship discount
- [ ] Target assignment: Specific products (promo only)
- [ ] Target assignment: All products (promo and autoship)
- [ ] Autoship discount defaults to "All Products"
- [ ] Warning shows if global autoship discount exists
- [ ] Save success toast
- [ ] Redirect to list after save

**Edit Discount Page**:
- [ ] Load existing discount data
- [ ] Update discount fields
- [ ] Change targets (add/remove products)
- [ ] Save changes
- [ ] Redirect to list after save

**Pricing Preview Tool**:
- [ ] Select product
- [ ] Toggle one-time vs autoship
- [ ] Calculate price
- [ ] Results show correct breakdown
- [ ] Test with multiple products
- [ ] Test with no discounts
- [ ] Test with multiple discounts

**Acceptance Criteria**:
- [ ] All checklist items pass
- [ ] No console errors
- [ ] No RLS policy violations
- [ ] UI responsive and intuitive

---

#### D.3 Mobile UI Tests

**Manual Testing Checklist**:

**Product List**:
- [ ] Prices load for all products
- [ ] Discount badge shows when applicable
- [ ] Autoship savings indicator shows
- [ ] Price formatting correct (IDR)
- [ ] No performance issues (smooth scrolling)

**Product Detail**:
- [ ] Base price displays
- [ ] Final price displays
- [ ] Price breakdown shows all discounts
- [ ] One-time vs autoship toggle works
- [ ] Autoship savings card shows
- [ ] Currency formatting correct

**Edge Cases**:
- [ ] Product with no discounts (shows base price only)
- [ ] Product with one discount
- [ ] Product with multiple discounts (stacked)
- [ ] Product not eligible for autoship (no autoship pricing)
- [ ] Network error handling (retry, error message)

**Acceptance Criteria**:
- [ ] All checklist items pass
- [ ] No console errors
- [ ] Performance acceptable (< 1s load time)
- [ ] Visual design consistent with Phase 2

---

## 6. Acceptance Criteria (Phase 3 Complete)

Phase 3 is complete when:

**Backend**:
- ✅ `compute_product_price()` function works correctly - **COMPLETE**
- ✅ `find_applicable_discounts()` finds discounts accurately - **COMPLETE**
- ✅ `apply_discount_stacking()` applies policies correctly - **COMPLETE**
- ✅ All test scenarios pass - **COMPLETE**
- ✅ Performance target met (< 100ms per call) - **COMPLETE**

**Admin App**:
- ✅ Discount CRUD operations work
- ✅ Target assignment works (products, all products)
- ✅ Active toggle works
- ✅ Pricing preview tool accurate
- ✅ All forms validated correctly
- ✅ RLS policies enforced

**Mobile App**:
- ✅ Product list shows final prices
- ✅ Discount badges display
- ✅ Autoship savings indicators show
- ✅ Product detail price breakdown accurate
- ✅ One-time vs autoship pricing comparison works
- ✅ Performance acceptable

**Documentation**:
- ✅ This Phase_3.md updated with final status
- ✅ Migration files documented
- ✅ CLAUDE.md updated (already done)

**Integration**:
- ✅ Admin can create discounts
- ✅ Mobile immediately reflects new discounts
- ✅ No breaking changes to existing features

---

## 7. Next Phase

**Phase 4: Orders & Checkout**
- Order creation with inventory validation
- Cart management UI
- Checkout flow with address selection
- Order history screens
- Price snapshots locked in orders
- Inventory decrement (transaction-safe)

**Prerequisites for Phase 4**:
- Phase 3 complete (pricing engine working)
- Admin can manage inventory
- Mobile shows accurate prices

---

## 8. Notes and Tips

### Pricing Principle Reminders
1. **Base prices are immutable**: Discounts NEVER modify `products.base_price_idr`
2. **Server-side only**: Clients never compute prices, always call backend functions
3. **Snapshots at order time**: Orders lock pricing when created (Phase 4)
4. **Historical accuracy**: Past orders never affected by future discount changes

### Global Autoship Discount Strategy
1. **One discount to rule them all**: Only ONE active global autoship discount
2. **Product eligibility**: Use `products.autoship_eligible` to enable/disable per product
3. **Simple messaging**: "Save 10% on every autoship order" is clear and easy
4. **Scalable**: Can add product-specific autoship discounts later without schema changes
5. **Follows Chewy.com model**: Consistent autoship savings across catalog

### Common Pitfalls to Avoid
- ❌ Don't compute prices on client (security risk, inconsistent)
- ❌ Don't overwrite base prices with discounts (violates immutability)
- ❌ Don't forget to test stacking policies (easy to get wrong)
- ❌ Don't skip time window validation (expired discounts must not apply)
- ❌ Don't allow negative final prices (always max(0, price - discount))

### Performance Considerations
- Use indexes on `discounts.active`, `discounts.starts_at`, `discounts.ends_at`
- Cache price computations on client (5 min TTL)
- Batch price computations for product lists
- Monitor RPC function performance (should be < 100ms)

### Testing Strategy
- Test backend functions in isolation first
- Test admin UI with various discount scenarios
- Test mobile UI with real products and discounts
- Verify RLS policies don't block legitimate access
- Validate edge cases (no discounts, multiple discounts, expired, etc.)

---

## 9. Recent Enhancements (2026-01-09)

### Schema Qualification Fix
- **Issue**: Functions were not properly qualified, causing "function does not exist" errors
- **Solution**: Created migration `20260109050000_ensure_pricing_functions_exist.sql`
- **Changes**:
  - All functions now use explicit `public.` schema prefix
  - Function calls within functions use fully qualified names
  - Added `SET search_path = ''` for security
  - All table references fully qualified

### UI Enhancements
1. **ProductSelector Component** (`apps/admin/components/product-selector.tsx`):
   - Enhanced product selection with search and family filters
   - Replaces simple chip list for better scalability
   - Features: debounced search, family filtering, bulk actions

2. **Admin Sidebar Navigation**:
   - Responsive sidebar with desktop/mobile support
   - Active link highlighting
   - Conditional rendering (hidden on auth pages)
   - Components: `admin-sidebar.tsx`, `admin-layout.tsx`, `layout-wrapper.tsx`

3. **Pricing Preview Improvements**:
   - Better error handling with clear messages
   - Cart total input for testing min order thresholds
   - Only shows valid products (published + has base price)
   - Clear note about automatic discount application

### Build Fixes
- Fixed client/server component separation (removed server-only imports from client components)
- Fixed Tailwind CSS class names (`flex-grow` → `grow`, `flex-shrink-0` → `shrink-0`)

---

## 10. Migration Files Checklist

- [x] `0014_pricing_schema_updates.sql` - Schema updates (applies_to_all_products, usage tracking)
- [x] `0015_pricing_functions.sql` - Core pricing functions
- [x] `0016_pricing_test_data.sql` - Test discounts and validation queries
- [x] `20260109040911_fix_rls_performance_and_security_warnings.sql` - Security fixes (includes function updates)
- [x] `20260109050000_ensure_pricing_functions_exist.sql` - **NEW** - Ensures functions exist with proper schema qualification
- [x] Verify discounts table has all columns from Doc 03
- [x] Verify discount_targets table schema matches Doc 03
- [x] Apply migrations: Applied via Supabase MCP
- [x] Test pricing functions in SQL Editor
- [x] Verify functions exist in public schema (no "function does not exist" errors)

---

## 11. Implementation Sequence (Recommended)

**Day 1-2 (Backend Foundation)**:
1. Write `compute_product_price()` function
2. Write `find_applicable_discounts()` function
3. Write `apply_discount_stacking()` function
4. Create test data migration
5. Run validation queries

**Day 3-4 (Admin UI)**:
1. Create discount list page
2. Create discount form (create/edit)
3. Implement target assignment
4. Add pricing preview tool
5. Test all admin operations

**Day 5-7 (Mobile UI)**:
1. Add price computation to product list
2. Add price breakdown to product detail
3. Add autoship savings indicator
4. Test all mobile pricing displays
5. Performance optimization

**Day 8-10 (Testing & Polish)**:
1. Run all backend tests
2. Run all admin UI tests
3. Run all mobile UI tests
4. Fix bugs and edge cases
5. Update documentation

---

## 11. Success Metrics

After Phase 3, you should be able to:
- ✅ Create a global autoship discount (10% off all autoship-eligible products)
- ✅ Create promo discounts (product-specific or all products)
- ✅ See discounts immediately reflected in mobile prices
- ✅ Switch between one-time and autoship pricing in mobile
- ✅ See accurate price breakdowns with all discounts
- ✅ Admin can preview pricing for any product
- ✅ Autoship pricing shows base price + autoship discount + promo discount (if stacked)
- ✅ Only one active global autoship discount at a time
- ✅ Historical discounts don't break (can be deactivated safely)

**Demo Flow (Global Autoship Discount)**:
1. Admin creates "Autoship 10% Off" global discount
2. Admin creates "15% Off Dog Food" promo discount (specific products)
3. Mobile user opens dog food product
4. Sees one-time purchase price:
   - Base: Rp 100,000 (strikethrough)
   - Promo: -Rp 15,000 (15% off)
   - Final: **Rp 85,000**
5. User toggles to autoship pricing:
   - Base: Rp 100,000 (strikethrough)
   - Autoship: -Rp 10,000 (10% off)
   - Promo: -Rp 13,500 (15% off remaining)
   - Final: **Rp 76,500**
   - Total savings: Rp 23,500 (23.5%)
6. Clear message: "💰 Save Rp 8,500 more with Autoship!"

---

## 12. Risk Mitigation

**Risk**: Pricing function too slow
**Mitigation**: Optimize query, add indexes, profile performance

**Risk**: Stacking policy confusing for admin
**Mitigation**: Add clear UI explanations and examples

**Risk**: RLS blocks legitimate pricing reads
**Mitigation**: Use `SECURITY DEFINER` on pricing functions, test thoroughly

**Risk**: Client-side caching causes stale prices
**Mitigation**: Set short TTL (5 min), force refresh on critical actions

**Risk**: Complex discount logic has bugs
**Mitigation**: Comprehensive test scenarios, manual validation

---

## End of Phase 3 Plan

This plan provides a complete roadmap for implementing the pricing engine and discount system. Follow the checklist format from Phase 1 and Phase 2, testing thoroughly at each step. Phase 3 is the foundation for orders (Phase 4) and autoship (Phase 5), so accuracy and reliability are critical.
