# Critical Issues Resolution Guide

**Version**: 2.0
**Last Updated**: 2026-01-03
**Priority**: HIGH - Address Before Phase 3
**Status**: Updated Based on Current Schema Snapshot

---

## Overview

This document outlines critical issues found during the codebase audit and provides detailed step-by-step resolution plans. **Updated to reflect current database state** (schema snapshot from 2026-01-03).

**Note**: Phase 3 (Orders & Checkout) is **not yet implemented**. Issues marked as "Phase 3 Requirement" are planned but not blocking current work.

---

## Quick Summary

**✅ Already Fixed** (2 issues):
- Issue 1: Product Variants Table - ✅ Removed
- Issue 2: Order Items Schema - ✅ Fixed

**✅ Recently Applied** (2 issues):
- Issue 7: Validation Constraints - ✅ Applied (2026-01-03)
- Issue 9: Orders INSERT Policy - ✅ Applied (2026-01-03)

**✅ Recently Fixed** (2 issues):
- Issue 5: Debug Logging - ✅ Removed (2026-01-03)
- Issue 6: Product Variant Values Overhead - ✅ Removed (2026-01-03)

**✅ Recently Applied** (1 issue):
- Issue 8: Category Field - ✅ Deprecated (2026-01-03)

**⏳ Phase 3 Requirements** (2 issues - not blocking now):
- Issue 3: Pricing Engine - Will implement in Phase 3
- Issue 4: Inventory Management - Will implement in Phase 3

**Action Items Before Phase 3**:
1. ✅ Apply migration `0002_fix_orders_policy_and_constraints.sql` - **DONE** (2026-01-03)
2. ✅ Remove debug logging from codebase - **DONE** (2026-01-03)
3. ✅ Deprecate category field - **DONE** (2026-01-03)

---

## Issue Summary

| # | Issue | Severity | Impact | Effort | Status |
|---|-------|----------|--------|--------|--------|
| 1 | Product Variants Table Orphaning | 🔴 HIGH | Data model confusion, schema drift | Medium | ✅ **FIXED** |
| 2 | Order Items Schema Inconsistency | 🔴 HIGH | Breaking change required | High | ✅ **FIXED** |
| 3 | Discount Application Logic Missing | 🔴 HIGH | Blocks Phase 3 | High | ⏳ Phase 3 Requirement |
| 4 | Inventory Validation Missing | 🔴 HIGH | Overselling risk | Medium | ⏳ Phase 3 Requirement |
| 5 | Debug Logging in Production Code | ⚠️ MEDIUM | Performance, security | Low | ✅ **FIXED** |
| 6 | Product Variant Values Assignment Overhead | ⚠️ MEDIUM | Network calls | Low | ✅ **FIXED** |
| 7 | Missing Validation Constraints | ⚠️ MEDIUM | Data integrity | Medium | ✅ **APPLIED** |
| 8 | Category Field Ambiguity | ⚠️ LOW | Query confusion | Low | ✅ **APPLIED** |
| 9 | Orders INSERT Policy Missing | 🔴 HIGH | Blocks Phase 3 | Low | ✅ **APPLIED** |

---

## Issue 1: Product Variants Table Orphaning

### Status: ✅ **FIXED**

**Verified**: 2026-01-03

### Current State

✅ **RESOLVED**: The current schema snapshot confirms:
- `product_variants` table **does not exist**
- `autoships` table uses `product_id` (not `product_variant_id`)
- `inventory` table uses `product_id` (not `product_variant_id`)
- `order_items` table uses `product_id` (not `product_variant_id`)
- All foreign keys reference `products.id` directly

**Schema Evidence**:
```sql
-- From snapshot:
autoships.product_id uuid NOT NULL REFERENCES public.products(id)
inventory.product_id uuid NOT NULL REFERENCES public.products(id)
order_items.product_id uuid NOT NULL REFERENCES public.products(id)
```

### Resolution

This issue was already fixed in a previous migration. The schema is now consistent with the architecture.

**No action required** ✅

#### Step 1: Audit Current Usage

**Query to check if any code still uses product_variants**:

```bash
# Search codebase for product_variants references
grep -r "product_variants" apps/admin apps/mobile supabase
```

**Check database for existing data**:

```sql
-- Check if product_variants has any rows
SELECT COUNT(*) FROM product_variants;

-- Check if any autoships reference it
SELECT COUNT(*) FROM autoships WHERE product_variant_id IS NOT NULL;

-- Check if any inventory references it
SELECT COUNT(*) FROM inventory WHERE product_variant_id IS NOT NULL;

-- Check if any orders reference it
SELECT COUNT(*) FROM order_items WHERE product_variant_id IS NOT NULL;
```

**Decision Tree**:
- If `product_variants` has data AND is referenced → Need migration
- If `product_variants` is empty → Can drop immediately
- If only sample data exists → Can truncate and drop

#### Step 2: Create Migration to Remove product_variants

**File**: `supabase/migrations/0013_remove_product_variants.sql`

```sql
-- Migration 0013: Remove product_variants table and update references
-- WARNING: This is a BREAKING CHANGE
-- Ensure all apps are updated before running this migration

BEGIN;

-- Step 1: Update autoships table
-- Add new product_id column
ALTER TABLE autoships ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE RESTRICT;

-- If data exists, migrate it
-- (Assuming product_variants.product_id exists and points to products)
UPDATE autoships
SET product_id = (
    SELECT product_id
    FROM product_variants
    WHERE id = autoships.product_variant_id
)
WHERE product_variant_id IS NOT NULL;

-- Make product_id NOT NULL
ALTER TABLE autoships ALTER COLUMN product_id SET NOT NULL;

-- Drop old column
ALTER TABLE autoships DROP COLUMN product_variant_id;

-- Recreate index
CREATE INDEX idx_autoships_product ON autoships(product_id);

-- Step 2: Update inventory table
-- Add new product_id column
ALTER TABLE inventory ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;

-- Migrate data (if exists)
UPDATE inventory
SET product_id = (
    SELECT product_id
    FROM product_variants
    WHERE id = inventory.product_variant_id
)
WHERE product_variant_id IS NOT NULL;

-- Make product_id NOT NULL
ALTER TABLE inventory ALTER COLUMN product_id SET NOT NULL;

-- Add unique constraint (one inventory record per product)
ALTER TABLE inventory ADD CONSTRAINT inventory_product_id_unique UNIQUE (product_id);

-- Drop old column and constraint
ALTER TABLE inventory DROP CONSTRAINT inventory_product_variant_id_key;
ALTER TABLE inventory DROP COLUMN product_variant_id;

-- Recreate index
CREATE INDEX idx_inventory_product ON inventory(product_id);

-- Step 3: Update order_items table
-- Add new product_id column
ALTER TABLE order_items ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE RESTRICT;

-- Migrate data (if exists)
UPDATE order_items
SET product_id = (
    SELECT product_id
    FROM product_variants
    WHERE id = order_items.product_variant_id
)
WHERE product_variant_id IS NOT NULL;

-- Make product_id NOT NULL
ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL;

-- Drop old column
ALTER TABLE order_items DROP COLUMN product_variant_id;

-- Recreate index
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Step 4: Drop product_variants table
DROP TABLE IF EXISTS product_variants CASCADE;

-- Step 5: Add comment documenting the change
COMMENT ON TABLE products IS 'Individual sellable items. Price and SKU are stored here (not in separate variants table). Each product can belong to a product_family and have variant_values assigned via product_variant_values junction table.';

COMMIT;
```

#### Step 3: Update Application Code

**Files to Update**:

1. **Admin App**:
   - `apps/admin/lib/products.ts`: Remove any `product_variants` queries
   - `apps/admin/lib/types.ts`: Remove `ProductVariant` type
   - Search all components for `product_variant` references

2. **Mobile App**:
   - `apps/mobile/lib/products.ts`: Same as admin
   - Search all screens for references

**Example Code Change**:

```typescript
// BEFORE (OLD):
const { data: inventory } = await supabase
  .from('inventory')
  .select('*')
  .eq('product_variant_id', variantId)
  .single()

// AFTER (NEW):
const { data: inventory } = await supabase
  .from('inventory')
  .select('*')
  .eq('product_id', productId)
  .single()
```

#### Step 4: Update RLS Policies

**Check if any RLS policies reference product_variants**:

```sql
-- Find RLS policies mentioning product_variants
SELECT
  schemaname,
  tablename,
  policyname,
  definition
FROM pg_policies
WHERE definition LIKE '%product_variants%';
```

**Update policies if needed**.

#### Step 5: Test Migration

**Local Testing**:

```bash
# 1. Reset local database
npx supabase db reset

# 2. Verify all migrations run successfully
# 3. Create test data
# 4. Verify products, inventory, autoships work
# 5. Run type checks
pnpm type-check
```

**Staging Deployment**:

```bash
# 1. Deploy to staging
npx supabase db push --project-ref <staging-ref>

# 2. Test admin app CRUD operations
# 3. Test mobile app product browsing
# 4. Verify no errors in Supabase logs
```

#### Step 6: Production Deployment

**Prerequisites**:
- ✅ Tested on staging for 48+ hours
- ✅ No errors in logs
- ✅ All apps updated and deployed
- ✅ Database backup created

**Deployment**:

```bash
# 1. Create manual backup
# (Supabase Dashboard → Database → Backups → Create Backup)

# 2. Deploy migration
npx supabase db push --project-ref <prod-ref>

# 3. Monitor for errors
# 4. If errors, have rollback plan ready
```

**Rollback Plan** (if needed):

```sql
-- Emergency rollback (creates product_variants table again)
-- Only use if absolutely necessary

BEGIN;

-- Recreate product_variants table (simplified)
CREATE TABLE product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Recreate foreign keys in other tables
ALTER TABLE autoships ADD COLUMN product_variant_id uuid REFERENCES product_variants(id);
-- ... (reverse the migration)

COMMIT;
```

---

## Issue 2: Order Items Schema Inconsistency

### Status: ✅ **FIXED**

**Verified**: 2026-01-03

### Current State

✅ **RESOLVED**: The current schema snapshot confirms:
- `order_items` table uses `product_id` directly
- References `products.id` (not `product_variants.id`)
- Schema matches documentation

**Schema Evidence**:
```sql
-- From snapshot:
order_items.product_id uuid NOT NULL REFERENCES public.products(id)
```

### Resolution

This issue was fixed in a previous migration. The schema now matches the documentation.

**No action required** ✅

---

## Issue 3: Discount Application Logic Missing

### Status: ⏳ **Phase 3 Requirement** (Not Yet Implemented)

**Note**: This is a **Phase 3 requirement**, not a current bug. The schema is ready, but the pricing engine functions need to be implemented during Phase 3.

### Current State

✅ **Schema Ready**: 
- `discounts` table exists with all required fields
- `discount_targets` table exists
- `order_items.discount_breakdown` jsonb field exists

❌ **Missing Implementation**:
- No server-side pricing computation function
- No logic to find applicable discounts
- No stacking policy implementation
- No price quote API

### Impact

- **Blocks Phase 3**: Cannot create orders without pricing
- **User Experience**: Cannot show discounts on product pages
- **Business Logic**: Autoship cheaper pricing not implemented

### When to Address

**During Phase 3** (Orders & Checkout implementation). This is expected and planned.

### Resolution Plan

#### Step 1: Design Pricing Algorithm

**See**: `/docs/guides/Discount_System.md` (already created above)

**Key Functions Needed**:
1. `find_applicable_discounts()` - Find discounts for a product
2. `calc_percentage_discount()` - Compute % discount
3. `calc_fixed_discount()` - Compute fixed amount discount
4. `calc_bogo_discount()` - Compute BOGO discount
5. `calc_tiered_discount()` - Compute tiered discount
6. `compute_product_price()` - Main pricing engine

#### Step 2: Create Pricing Engine Migration

**File**: `supabase/migrations/0015_pricing_engine.sql`

**Contents**: All SQL functions from `/docs/guides/Discount_System.md`

#### Step 3: Create Edge Function for Cart Pricing

**File**: `supabase/functions/compute-cart-price/index.ts`

**Purpose**: Compute total cart price with all discounts applied

**See**: `/docs/guides/Discount_System.md` → Implementation Guide → Phase 3C

#### Step 4: Implement Product Price Display

**Admin App**:
- Product list: Show base price + autoship price (if eligible)
- Product edit: Show pricing calculator

**Mobile App**:
- Product detail: Show base price, autoship price, savings
- Product list: Show final price with discount badge

#### Step 5: Test Pricing Engine

**Unit Tests**:
```typescript
describe('Pricing Engine', () => {
  it('applies single discount correctly')
  it('applies best-only stacking policy')
  it('stacks autoship with promo')
  it('handles BOGO')
  it('handles tiered pricing')
  it('respects usage limits')
  it('never returns negative price')
})
```

**Integration Tests**:
- Create discount via admin UI
- View product in mobile app
- Verify correct price shown
- Add to cart
- Verify cart total correct

#### Estimated Effort

- SQL functions: 2-3 days
- Edge function: 1 day
- Admin UI updates: 2 days
- Mobile UI updates: 3 days
- Testing: 2 days

**Total: ~10 days (2 weeks)**

---

## Issue 4: Inventory Validation Missing

### Status: ⏳ **Phase 3 Requirement** (Not Yet Implemented)

**Note**: This is a **Phase 3 requirement**, not a current bug. The schema is ready, but the inventory management functions need to be implemented during Phase 3.

### Current State

✅ **Schema Ready**:
- `inventory` table exists with `stock_quantity`
- `inventory_movements` table exists for audit trail
- Foreign keys and indexes in place

❌ **Missing Implementation**:
- No check if product is in stock
- No decrement logic
- No transaction safety
- No prevention of negative inventory
- No allocation/reservation pattern

### Impact

- **Overselling Risk**: Can sell out-of-stock products (when Phase 3 is implemented)
- **Data Integrity**: Inventory can go negative (when Phase 3 is implemented)
- **User Experience**: Orders created then cancelled due to no stock
- **Business Loss**: Fulfillment failures

### When to Address

**During Phase 3** (Orders & Checkout implementation). This is expected and planned.

### Resolution Plan

#### Step 1: Define Inventory Management Flow

**Allocation vs Decrement**:

**Option A: Immediate Decrement**
```
User clicks "Buy" → Decrement inventory → Create order
```
- **Pros**: Simple
- **Cons**: Abandoned carts remove inventory

**Option B: Allocate on Cart, Decrement on Payment**
```
User adds to cart → Allocate (reserve) inventory
User pays → Decrement inventory, remove allocation
Cart expires (30 min) → Release allocation
```
- **Pros**: More accurate inventory
- **Cons**: Complex state management

**Recommendation**: Start with **Option A** (immediate decrement), upgrade to Option B in Phase 4.

#### Step 2: Create Inventory Functions

**File**: `supabase/migrations/0016_inventory_management.sql`

```sql
-- Check product availability
CREATE OR REPLACE FUNCTION check_product_availability(
    p_product_id uuid,
    p_quantity int
) RETURNS boolean AS $$
DECLARE
    v_stock_quantity int;
BEGIN
    SELECT stock_quantity INTO v_stock_quantity
    FROM inventory
    WHERE product_id = p_product_id;

    IF v_stock_quantity IS NULL THEN
        -- No inventory record = unlimited stock
        RETURN true;
    END IF;

    RETURN v_stock_quantity >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Decrement inventory (transaction-safe)
CREATE OR REPLACE FUNCTION decrement_inventory(
    p_product_id uuid,
    p_quantity int,
    p_order_id uuid,
    p_reason text DEFAULT 'order'
) RETURNS void AS $$
DECLARE
    v_current_stock int;
BEGIN
    -- Lock the row to prevent race conditions
    SELECT stock_quantity INTO v_current_stock
    FROM inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'No inventory record for product %', p_product_id;
    END IF;

    IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient inventory for product %. Available: %, Requested: %',
            p_product_id, v_current_stock, p_quantity;
    END IF;

    -- Update inventory
    UPDATE inventory
    SET
        stock_quantity = stock_quantity - p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    -- Record movement
    INSERT INTO inventory_movements (
        inventory_id,
        quantity_change,
        reason,
        reference_id,
        created_at
    )
    SELECT
        id,
        -p_quantity,
        p_reason,
        p_order_id,
        NOW()
    FROM inventory
    WHERE product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Increment inventory (for returns, restocks)
CREATE OR REPLACE FUNCTION increment_inventory(
    p_product_id uuid,
    p_quantity int,
    p_reference_id uuid DEFAULT NULL,
    p_reason text DEFAULT 'restock'
) RETURNS void AS $$
BEGIN
    -- Lock the row
    SELECT 1 FROM inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    -- Update inventory
    UPDATE inventory
    SET
        stock_quantity = stock_quantity + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    -- Record movement
    INSERT INTO inventory_movements (
        inventory_id,
        quantity_change,
        reason,
        reference_id,
        created_at
    )
    SELECT
        id,
        p_quantity,
        p_reason,
        p_reference_id,
        NOW()
    FROM inventory
    WHERE product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Get current stock level
CREATE OR REPLACE FUNCTION get_stock_quantity(
    p_product_id uuid
) RETURNS int AS $$
DECLARE
    v_stock int;
BEGIN
    SELECT stock_quantity INTO v_stock
    FROM inventory
    WHERE product_id = p_product_id;

    -- If no inventory record, assume unlimited
    IF v_stock IS NULL THEN
        RETURN 999999; -- Large number to indicate "unlimited"
    END IF;

    RETURN v_stock;
END;
$$ LANGUAGE plpgsql;
```

#### Step 3: Update Order Creation Logic

**Integrate inventory validation into order creation**:

```typescript
// supabase/functions/create-order/index.ts
async function createOrder(cartItems, userId) {
  const supabase = createClient(...)

  // Start transaction
  const { data, error } = await supabase.rpc('create_order_with_inventory', {
    p_user_id: userId,
    p_items: cartItems, // [{ product_id, quantity }]
    p_source: 'cart',
  })

  if (error) {
    if (error.message.includes('Insufficient inventory')) {
      return {
        success: false,
        error: 'OUT_OF_STOCK',
        message: 'Some items are out of stock. Please adjust your cart.'
      }
    }
    throw error
  }

  return { success: true, order_id: data.order_id }
}
```

**SQL Function**:

```sql
CREATE OR REPLACE FUNCTION create_order_with_inventory(
    p_user_id uuid,
    p_items jsonb, -- [{"product_id": "uuid", "quantity": 2}, ...]
    p_source text DEFAULT 'cart'
) RETURNS jsonb AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_product_id uuid;
    v_quantity int;
    v_price_data jsonb;
BEGIN
    -- 1. Validate all items have sufficient inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::int;

        IF NOT check_product_availability(v_product_id, v_quantity) THEN
            RAISE EXCEPTION 'Insufficient inventory for product %', v_product_id;
        END IF;
    END LOOP;

    -- 2. Create order
    INSERT INTO orders (user_id, status, source, created_at)
    VALUES (p_user_id, 'pending', p_source, NOW())
    RETURNING id INTO v_order_id;

    -- 3. Create order items and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::int;

        -- Compute price with discounts
        v_price_data := compute_product_price(
            v_product_id,
            p_user_id,
            p_source = 'autoship',
            v_quantity,
            0, -- cart_total (TODO: compute actual)
            NULL -- coupon_code
        );

        -- Create order item
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            unit_base_price_idr,
            unit_final_price_idr,
            discount_breakdown
        ) VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            (v_price_data->>'base_price_idr')::int,
            ((v_price_data->>'final_price_idr')::int / v_quantity),
            v_price_data->'discounts_applied'
        );

        -- Decrement inventory
        PERFORM decrement_inventory(
            v_product_id,
            v_quantity,
            v_order_id,
            'order'
        );
    END LOOP;

    -- 4. Update order totals
    UPDATE orders
    SET
        subtotal_idr = (
            SELECT SUM(unit_base_price_idr * quantity)
            FROM order_items
            WHERE order_id = v_order_id
        ),
        total_price_idr = (
            SELECT SUM(unit_final_price_idr * quantity)
            FROM order_items
            WHERE order_id = v_order_id
        ),
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'success', true
    );
END;
$$ LANGUAGE plpgsql;
```

#### Step 4: Add Low Stock Warnings

**Admin Dashboard**:
- Show low stock warnings (< 10 units)
- Alert when product goes out of stock
- Daily email digest of low stock products

**Mobile App**:
- Show "Only 3 left in stock!" on product pages
- Disable "Add to Cart" if out of stock
- Show "Out of Stock" badge

#### Step 5: Test Inventory Management

**Race Condition Test**:
```typescript
// Test concurrent order creation
test('prevents overselling during concurrent orders', async () => {
  await setInventory(productId, 1) // Only 1 in stock

  // Try to create 2 orders simultaneously
  const promises = [
    createOrder([{ product_id: productId, quantity: 1 }], user1Id),
    createOrder([{ product_id: productId, quantity: 1 }], user2Id),
  ]

  const results = await Promise.allSettled(promises)

  // One should succeed, one should fail
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.success)
  const failures = results.filter(r => r.status === 'rejected' || !r.value.success)

  expect(successes).toHaveLength(1)
  expect(failures).toHaveLength(1)
})
```

---

## Issue 5: Debug Logging in Production Code

### Problem

File: `apps/admin/lib/product-variant-values.ts` (lines 87-151)

Contains external HTTP logging calls:
```typescript
try {
  await fetch('http://127.0.0.1:7243/ingest/...', {...})
} catch(e) { }
```

This was likely added for debugging variant assignment issues but:
- Creates unnecessary network calls
- Leaks data to external service
- Slows down operations
- Security risk if sensitive data in payload

### Impact

- **Performance**: Extra HTTP request per operation
- **Security**: Data sent to localhost (harmless in prod, but indicates poor practice)
- **Code Quality**: Debug code not removed before merge

### Resolution Plan

#### Step 1: Remove Debug Logging

**File**: `apps/admin/lib/product-variant-values.ts`

**Change**:
```typescript
// BEFORE (lines 87-151):
try {
  await fetch('http://127.0.0.1:7243/ingest/variant-assignment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debug_data })
  })
} catch (e) {
  // Silently fail
}

// AFTER:
// Removed debug logging
```

**Alternative** (if logging is needed):

```typescript
// Use environment-gated logging
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_LOGGING === 'true') {
  console.debug('[variant-assignment]', { productId, variantValueIds })
}
```

#### Step 2: Add Proper Structured Logging

**Recommendation**: Use a proper logging library

**Install Pino** (fast, structured logger):

```bash
cd apps/admin
npm install pino pino-pretty
```

**Create logger utility**:

```typescript
// apps/admin/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
})
```

**Usage**:

```typescript
import { logger } from '@/lib/logger'

export async function setProductVariantValues(productId, variantValueIds) {
  logger.debug({ productId, variantValueIds }, 'Setting product variant values')

  // ... operation ...

  logger.info({ productId, count: variantValueIds.length }, 'Variant values set successfully')
}
```

#### Step 3: Code Review Checklist

Add to `.github/pull_request_template.md`:

```markdown
## Checklist
- [ ] No debug logging or external HTTP calls in production code
- [ ] Console.log statements removed (or environment-gated)
- [ ] No hardcoded URLs or credentials
- [ ] Proper error logging in place
```

---

## Issue 6: Product Variant Values Assignment Overhead

(Duplicate of Issue 5 - same file)

**Resolution**: See Issue 5.

---

## Issue 7: Missing Validation Constraints

### Status: ⏳ **Migration Created, Not Applied**

**Migration**: `supabase/migrations/0002_fix_orders_policy_and_constraints.sql` (created but not yet applied)

### Problem

Some logical constraints not enforced at database level:

1. **Orders Status**: No CHECK constraint (should be: pending, paid, processing, shipped, delivered, cancelled, refunded)
2. **Orders Source**: No CHECK constraint (should be: one_time, autoship)
3. **Autoships Status**: No CHECK constraint (should be: active, paused, cancelled)
4. **Discounts**: No CHECK constraints for discount_type, kind, stack_policy
5. **Product Variant Values**: No check that product has all dimensions from family
6. **Products in Family**: No validation that required dimensions are assigned

### Impact

- **Data Integrity**: Invalid data can be inserted
- **Bug Risk**: Client-side validation can be bypassed
- **Inconsistent State**: Products without all variant values

### Resolution Plan

**Migration Already Created**: `supabase/migrations/0002_fix_orders_policy_and_constraints.sql`

This migration includes:
- ✅ CHECK constraints for orders.status, orders.source
- ✅ CHECK constraints for autoships.status, autoship_runs.status
- ✅ CHECK constraints for discounts.discount_type, discounts.kind, discounts.stack_policy
- ✅ Orders INSERT policy

**✅ Applied**: Migration `0002_fix_orders_policy_and_constraints.sql` was successfully applied on 2026-01-03.

**Note**: The migration also updated existing discount data:
- `discount_type`: "percent" → "percentage"
- `stack_policy`: "stack_with_autoship" → "stack"

#### Step 1: Add Trigger for Variant Value Validation

**File**: `supabase/migrations/0017_add_validation_triggers.sql` (for variant-specific validation)

```sql
-- Ensure products in a family have all dimension values assigned

CREATE OR REPLACE FUNCTION validate_product_variant_values()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id uuid;
    v_required_dimension_count int;
    v_assigned_dimension_count int;
BEGIN
    -- Get product's family
    SELECT family_id INTO v_family_id
    FROM products
    WHERE id = NEW.product_id;

    -- If product not in a family, no validation needed
    IF v_family_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count required dimensions
    SELECT COUNT(*) INTO v_required_dimension_count
    FROM variant_dimensions
    WHERE family_id = v_family_id;

    -- Count assigned dimensions (after this insert)
    SELECT COUNT(DISTINCT vv.dimension_id) INTO v_assigned_dimension_count
    FROM product_variant_values pvv
    JOIN variant_values vv ON vv.id = pvv.variant_value_id
    WHERE pvv.product_id = NEW.product_id;

    -- Allow partial assignments (will be validated on product update)
    -- This trigger only warns, doesn't block
    IF v_assigned_dimension_count < v_required_dimension_count THEN
        RAISE WARNING 'Product % does not have all variant dimensions assigned. Expected: %, Got: %',
            NEW.product_id, v_required_dimension_count, v_assigned_dimension_count;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_product_variant_values_trigger
AFTER INSERT OR UPDATE ON product_variant_values
FOR EACH ROW
EXECUTE FUNCTION validate_product_variant_values();

-- Ensure products in a family are not published without all variant values
CREATE OR REPLACE FUNCTION validate_product_publish()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id uuid;
    v_required_dimension_count int;
    v_assigned_dimension_count int;
BEGIN
    -- Only validate if product is being published
    IF NEW.published = false OR OLD.published = NEW.published THEN
        RETURN NEW;
    END IF;

    -- Get product's family
    v_family_id := NEW.family_id;

    -- If product not in a family, allow publish
    IF v_family_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count required dimensions
    SELECT COUNT(*) INTO v_required_dimension_count
    FROM variant_dimensions
    WHERE family_id = v_family_id;

    -- Count assigned dimensions
    SELECT COUNT(DISTINCT vv.dimension_id) INTO v_assigned_dimension_count
    FROM product_variant_values pvv
    JOIN variant_values vv ON vv.id = pvv.variant_value_id
    WHERE pvv.product_id = NEW.id;

    -- Block publish if not all dimensions assigned
    IF v_assigned_dimension_count < v_required_dimension_count THEN
        RAISE EXCEPTION 'Cannot publish product %. Missing variant dimensions. Expected: %, Got: %',
            NEW.id, v_required_dimension_count, v_assigned_dimension_count;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_product_publish_trigger
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_product_publish();
```

#### Step 2: Add Constraint to Prevent Duplicate Variant Values

```sql
-- Prevent assigning multiple values from same dimension to one product
CREATE UNIQUE INDEX idx_product_variant_values_unique_dimension
ON product_variant_values (product_id, (
    SELECT dimension_id FROM variant_values WHERE id = variant_value_id
));

-- Note: This uses a functional index with subquery
-- Alternative: Add dimension_id to product_variant_values table for simpler constraint
```

#### Step 3: Test Validation

**Test Case 1: Publish without all dimensions**:
```typescript
test('prevents publishing product without all variant values', async () => {
  const family = await createFamily()
  await createDimension(family.id, 'Flavor')
  await createDimension(family.id, 'Size')

  const product = await createProduct({ family_id: family.id, published: false })

  // Assign only Flavor, not Size
  await assignVariantValue(product.id, flavorValue.id)

  // Try to publish
  const result = await updateProduct(product.id, { published: true })

  expect(result.error).toBeTruthy()
  expect(result.error.message).toContain('Missing variant dimensions')
})
```

**Test Case 2: Assign duplicate dimension**:
```typescript
test('prevents assigning multiple values from same dimension', async () => {
  const product = await createProduct()
  await assignVariantValue(product.id, lambValue.id) // Flavor: Lamb

  // Try to assign another Flavor
  const result = await assignVariantValue(product.id, chickenValue.id) // Flavor: Chicken

  expect(result.error).toBeTruthy()
})
```

---

## Issue 8: Category Field Ambiguity

### Status: ✅ **APPLIED**

**Migration**: `supabase/migrations/0003_deprecate_category_field.sql` (applied 2026-01-03)

### Problem (Resolved)

`products.category` existed alongside new `product_tags` system, causing:
- Query confusion (which to use?)
- Data duplication (same info in two places)
- Maintenance burden (keep both in sync)

### Resolution

**✅ Applied**: Migration `0003_deprecate_category_field.sql` was successfully applied on 2026-01-03.

**What was done**:
1. ✅ Added deprecation comment to `products.category` column
2. ✅ Created tags from existing categories:
   - "dog-food" → tag created
   - "Shirt" → tag created
3. ✅ Assigned tags to products (3 products migrated)
4. ✅ Added `category_migrated_at` timestamp column
5. ✅ Marked migrated products with timestamp

**Current State**:
- `products.category` column still exists (for backward compatibility)
- All products with categories now have corresponding tags
- New code should use `product_tags` system
- Old `category` field will be removed in Phase 4+

**Migration Applied**: `supabase/migrations/0003_deprecate_category_field.sql`

**Results**:
- ✅ 2 new tags created: "dog-food" and "Shirt"
- ✅ 3 products migrated (all had tags assigned)
- ✅ `category_migrated_at` column added
- ✅ Deprecation comment added to column

**Note**: The `category` column remains for backward compatibility but is now deprecated. It will be removed in Phase 4+.

**Code Updates**:

```typescript
// BEFORE:
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('category', 'dog-food')

// AFTER:
const { data } = await supabase
  .from('products')
  .select(`
    *,
    product_tag_assignments!inner(
      product_tags(slug)
    )
  `)
  .eq('product_tag_assignments.product_tags.slug', 'dog-food')
```

**Next Steps** (Future):
- Phase 4+: Remove `products.category` column entirely
- Update any remaining code that queries by `category` to use `product_tags` instead

---

## Issue 9: Orders INSERT Policy Missing

### Status: ✅ **APPLIED**

**Migration**: `supabase/migrations/0002_fix_orders_policy_and_constraints.sql` (applied 2026-01-03)

### Problem (Resolved)

The `orders` table only had a SELECT policy, but no INSERT policy. This would have blocked Phase 3 order creation.

**Current State**:
```sql
-- Only SELECT policy exists
CREATE POLICY "orders_select_own_or_admin" ON public.orders
    FOR SELECT
    USING ((auth.uid() = user_id) OR is_admin());
-- ❌ No INSERT policy!
```

### Impact

- **Blocks Phase 3**: Cannot create orders via RLS
- **Edge Functions**: Will work (service role bypasses RLS), but policy should exist for clarity
- **Client-side**: Cannot create orders directly (if needed)

### Resolution

**Migration Already Created**: `supabase/migrations/0002_fix_orders_policy_and_constraints.sql`

This migration includes:
```sql
CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
```

**✅ Applied**: Migration `0002_fix_orders_policy_and_constraints.sql` was successfully applied on 2026-01-03.

**Note**: Edge Functions using service role key bypass RLS anyway, but having the policy is good practice and allows flexibility for client-side order creation if needed.

---

## Implementation Timeline

### Before Phase 3 (Current Priority)

**Priority: HIGH** - Must complete before Phase 3

| Task | Effort | Assigned | Status |
|------|--------|----------|--------|
| ✅ Issue 1: Remove product_variants | - | - | ✅ **FIXED** (already done) |
| ✅ Issue 2: Order Items Schema | - | - | ✅ **FIXED** (already done) |
| ✅ Issue 7: Apply validation constraints | - | - | ✅ **APPLIED** (2026-01-03) |
| ✅ Issue 9: Apply Orders INSERT policy | - | - | ✅ **APPLIED** (2026-01-03) |
| ✅ Issue 5: Remove debug logging | - | - | ✅ **FIXED** (2026-01-03) |
| ✅ Issue 6: Remove variant values overhead | - | - | ✅ **FIXED** (2026-01-03) |
| ✅ Issue 8: Deprecate category | - | - | ✅ **APPLIED** (2026-01-03) |

**Total: ✅ ALL COMPLETE** (all critical issues resolved before Phase 3)

### Phase 3 (Orders & Checkout) - Planned

**Priority: HIGH** - Core business functionality

| Task | Effort | Assigned | Status |
|------|--------|----------|--------|
| Issue 3: Pricing engine | 5 days | - | ⏳ Phase 3 Requirement |
| Issue 4: Inventory management | 3 days | - | ⏳ Phase 3 Requirement |
| Order creation flow | 5 days | - | ⏳ Phase 3 Requirement |
| Payment integration | 5 days | - | ⏳ Phase 3 Requirement |

**Total: 18 days (~3.5 weeks)**

### Phase 3 (Orders & Checkout)

**Priority: HIGH** - Core business functionality

| Task | Effort | Assigned | Status |
|------|--------|----------|--------|
| Issue 3: Pricing engine | 5 days | - | ⏳ Not Started |
| Issue 4: Inventory management | 3 days | - | ⏳ Not Started |
| Order creation flow | 5 days | - | ⏳ Not Started |
| Payment integration | 5 days | - | ⏳ Not Started |

**Total: 18 days (~3.5 weeks)**

---

## Verification Checklist

### Before Phase 3 (Current)

- [x] `product_variants` table removed ✅ (verified in schema snapshot)
- [x] All references updated to `products` table ✅ (verified in schema snapshot)
- [x] Migration `0002_fix_orders_policy_and_constraints.sql` applied ✅ (2026-01-03)
- [x] CHECK constraints verified in database ✅ (7 constraints created)
- [x] Orders INSERT policy verified ✅ (`orders_insert_own` policy exists)
- [x] Debug logging removed from production code ✅ (31 instances removed)
- [x] Category field deprecated ✅ (migration `0003` applied, tags created, assignments linked)
- [ ] No failing type checks: `pnpm type-check`
- [ ] No errors in Supabase logs
- [ ] Admin app CRUD operations work
- [ ] Mobile app product browsing works

### Phase 3 (When Implementing)

- [ ] Pricing engine implemented and tested
- [ ] Inventory validation implemented and tested
- [ ] Test orders can be created
- [ ] Inventory decrements correctly
- [ ] Discounts apply correctly

---

## Summary of Current State

### ✅ Already Fixed (No Action Needed)

1. **Issue 1: Product Variants Table** - ✅ Removed, all tables use `product_id`
2. **Issue 2: Order Items Schema** - ✅ Uses `product_id` directly

### ✅ Recently Applied

3. **Issue 7: Validation Constraints** - ✅ Applied via migration `0002` (2026-01-03)
4. **Issue 9: Orders INSERT Policy** - ✅ Applied via migration `0002` (2026-01-03)

### ✅ Recently Applied (Before Phase 3)

5. **Issue 5: Debug Logging** - ✅ Removed (2026-01-03)
6. **Issue 8: Category Field** - ✅ Deprecated via migration `0003` (2026-01-03)

### ⏳ Phase 3 Requirements (Not Blocking Now)

7. **Issue 3: Pricing Engine** - Will implement during Phase 3
8. **Issue 4: Inventory Management** - Will implement during Phase 3

---

## Rollback Plans

### If Migration Fails in Production

**Validation constraints migration**:
1. Migration is additive (only adds constraints)
2. If constraint fails, check existing data
3. Fix data or adjust constraint
4. Re-apply migration

**Pricing engine errors**:
1. Disable pricing edge function
2. Fall back to showing base prices only
3. Fix function
4. Redeploy

**Inventory errors**:
1. Disable order creation temporarily
2. Show "Temporarily unavailable" message
3. Fix function
4. Re-enable orders

---

## Communication Plan

### Internal Team

**Before Starting**:
- Review this document with team
- Assign tasks
- Set deadline: Complete before Phase 3 start

**During Implementation**:
- Daily standup updates
- Slack notifications when migrations deployed
- Document any issues encountered

**After Completion**:
- Demo fixed functionality
- Update architecture docs
- Close related GitHub issues

### Users (if applicable)

If any downtime required:
- Email notification 48 hours before
- Status page update
- Maintenance window: 2am-4am Jakarta time (low traffic)

---

**Document Status**: ✅ Complete
**Next Steps**: Review with team, assign tasks, begin implementation
