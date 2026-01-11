# Discount System - Industry Standard Implementation

**Version**: 1.0
**Last Updated**: 2026-01-07
**Phase**: 3
**Status**: Implementation Guide

---

## Table of Contents

1. [Overview](#overview)
2. [Industry Best Practices](#industry-best-practices)
3. [Discount Types](#discount-types)
4. [Database Schema](#database-schema)
5. [Discount Rules Engine](#discount-rules-engine)
6. [Stacking Logic](#stacking-logic)
7. [Implementation Guide](#implementation-guide)
8. [API Endpoints](#api-endpoints)
9. [Admin UI](#admin-ui)
10. [Testing Strategy](#testing-strategy)

---

## Overview

Pawie's discount system implements industry-standard promotional mechanics used by leading e-commerce platforms (Amazon, Shopify, Chewy, etc.). The system supports multiple discount types, complex targeting, and intelligent stacking rules.

### Key Design Principles

1. **Never Modify Base Price**: Discounts are rules applied at read/checkout time
2. **Price Transparency**: Show original price, discount, and final price
3. **Audit Trail**: Orders store complete discount breakdown
4. **Flexibility**: Support product, category, cart-level, and user-specific discounts
5. **Stacking Control**: Define which discounts can combine

### System Capabilities

- ✅ Percentage discounts (10% off)
- ✅ Fixed amount discounts (Rp 50,000 off)
- ✅ BOGO (Buy One Get One)
- ✅ Tiered pricing (Buy 3+, save 15%)
- ✅ Cart-level discounts (Minimum purchase)
- ✅ Category-wide sales
- ✅ Product-specific promotions
- ✅ Autoship discounts
- ✅ First-time customer discounts
- ✅ User-specific discounts (VIP, loyalty tiers)
- ✅ Coupon codes
- ✅ Time-limited campaigns
- ✅ Stacking policies (best only vs stackable)

---

## Industry Best Practices

### Amazon's Approach

**Discount Display**:
```
List Price:     $99.99
Deal:          -$20.00 (20% off)
You Save:       $20.00
Final Price:    $79.99
```

**Key Patterns**:
- Always show strike-through original price
- Highlight savings percentage in red
- Use "Limited time deal" badges
- Show coupon availability: "Apply Rp 10,000 coupon"
- Lightning deals create urgency

### Shopify's Approach

**Discount Types**:
1. **Percentage**: 10% off all orders
2. **Fixed Amount**: Rp 50,000 off
3. **Free Shipping**: No shipping fee
4. **BOGO**: Buy X, get Y free
5. **Automatic**: Applied at cart
6. **Code**: Requires coupon code

**Admin Features**:
- Visual discount builder
- Clear eligibility rules
- Usage limits (total, per customer)
- Combination controls
- Performance analytics

### Chewy's Approach

**Discount Hierarchy**:
1. **Autoship Discount**: 5-10% (always applied)
2. **Promotional Discounts**: Time-limited sales
3. **Coupon Codes**: Stackable with autoship
4. **First Order**: 20-30% off first purchase

**Stacking Rules**:
- Autoship + Promo = Stack
- Autoship + Coupon = Stack
- Promo + Coupon = Best only

### Wayfair's Approach

**Tiered Discounts**:
```
Buy 1-2 items: 10% off
Buy 3-4 items: 15% off
Buy 5+ items: 20% off
```

**Volume Incentives**:
- Encourages larger basket sizes
- Clear tier breakpoints
- Show next tier savings: "Add 1 more item for 15% off!"

---

## Discount Types

### 1. Percentage Discounts

**Use Case**: Most common promotion type

**Examples**:
- 10% off all dog food
- 25% off clearance items
- 5% loyalty discount

**Configuration**:
```json
{
  "type": "percentage",
  "value": 10,
  "applies_to": "category",
  "category": "dog-food"
}
```

**Calculation**:
```typescript
discount_amount = base_price * (discount_value / 100)
final_price = base_price - discount_amount
```

### 2. Fixed Amount Discounts

**Use Case**: Minimum purchase incentives

**Examples**:
- Rp 50,000 off orders over Rp 500,000
- Rp 10,000 off first purchase
- Rp 100,000 off premium products

**Configuration**:
```json
{
  "type": "fixed_amount",
  "value": 50000,
  "min_purchase": 500000,
  "applies_to": "cart"
}
```

**Calculation**:
```typescript
if (cart_total >= min_purchase) {
  discount_amount = discount_value
  final_price = cart_total - discount_amount
}
```

### 3. BOGO (Buy One Get One)

**Use Case**: Clear inventory, reward loyalty

**Examples**:
- Buy 2, get 1 free
- Buy 1, get 50% off second
- Buy 3, get cheapest free

**Configuration**:
```json
{
  "type": "bogo",
  "buy_quantity": 2,
  "get_quantity": 1,
  "get_discount_percent": 100,
  "applies_to": "product",
  "product_id": "uuid"
}
```

**Calculation**:
```typescript
eligible_sets = Math.floor(quantity / (buy_quantity + get_quantity))
free_items = eligible_sets * get_quantity
discount_amount = free_items * unit_price * (get_discount_percent / 100)
```

### 4. Tiered Pricing (Volume Discounts)

**Use Case**: Encourage bulk purchases

**Examples**:
- Buy 1-2: Rp 100,000 each
- Buy 3-5: Rp 90,000 each (10% off)
- Buy 6+: Rp 80,000 each (20% off)

**Configuration**:
```json
{
  "type": "tiered",
  "tiers": [
    { "min_quantity": 1, "max_quantity": 2, "discount_percent": 0 },
    { "min_quantity": 3, "max_quantity": 5, "discount_percent": 10 },
    { "min_quantity": 6, "max_quantity": null, "discount_percent": 20 }
  ],
  "applies_to": "product"
}
```

### 5. Cart-Level Discounts

**Use Case**: Minimum cart value promotions

**Examples**:
- 10% off orders over Rp 300,000
- Free shipping on Rp 500,000+
- Rp 20,000 off carts with 5+ items

**Configuration**:
```json
{
  "type": "cart_percentage",
  "value": 10,
  "min_cart_value": 300000,
  "min_item_count": 0
}
```

### 6. Autoship Discounts

**Use Case**: Subscription incentive

**Examples**:
- Save 10% with autoship
- 5% recurring discount
- Free shipping on all autoship

**Configuration**:
```json
{
  "type": "percentage",
  "kind": "autoship",
  "value": 10,
  "applies_to": "all",
  "stack_policy": "stack_with_promo"
}
```

### 7. First-Time Customer Discounts

**Use Case**: Acquisition incentive

**Examples**:
- 30% off first order
- Rp 100,000 off first purchase over Rp 500,000
- Free shipping on first order

**Configuration**:
```json
{
  "type": "percentage",
  "value": 30,
  "eligibility": "first_order_only",
  "max_uses_per_user": 1
}
```

### 8. Coupon Codes

**Use Case**: Marketing campaigns, partnerships, referrals

**Examples**:
- WELCOME20 (20% off)
- FREESHIP (free shipping)
- REFER50 (Rp 50,000 off)

**Configuration**:
```json
{
  "type": "percentage",
  "value": 20,
  "code": "WELCOME20",
  "requires_code": true,
  "max_uses": 1000,
  "max_uses_per_user": 1
}
```

---

## Database Schema

### Current Schema (Phase 1)

```sql
CREATE TABLE discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    kind text NOT NULL CHECK (kind IN ('promo', 'autoship')),
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value numeric NOT NULL CHECK (discount_value > 0),
    start_date timestamptz,
    end_date timestamptz,
    active boolean DEFAULT true,
    stack_policy text DEFAULT 'best_only' CHECK (stack_policy IN ('best_only', 'stack_with_autoship')),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE discount_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
    category text,
    applies_to_all_products boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW(),
    CONSTRAINT discount_targets_check CHECK (
        (product_id IS NOT NULL)::int +
        (product_variant_id IS NOT NULL)::int +
        (category IS NOT NULL)::int +
        (applies_to_all_products = true)::int = 1
    )
);

CREATE INDEX idx_discounts_active ON discounts(active) WHERE active = true;
CREATE INDEX idx_discounts_dates ON discounts(start_date, end_date) WHERE active = true;
CREATE INDEX idx_discount_targets_product ON discount_targets(product_id);
CREATE INDEX idx_discount_targets_category ON discount_targets(category);
```

### Schema Enhancements Needed

```sql
-- Migration: 0014_enhance_discounts.sql

-- 1. Add more discount types
ALTER TABLE discounts DROP CONSTRAINT discounts_discount_type_check;
ALTER TABLE discounts ADD CONSTRAINT discounts_discount_type_check
    CHECK (discount_type IN ('percentage', 'fixed_amount', 'bogo', 'tiered', 'free_shipping'));

-- 2. Add BOGO configuration
ALTER TABLE discounts ADD COLUMN bogo_buy_quantity int;
ALTER TABLE discounts ADD COLUMN bogo_get_quantity int;
ALTER TABLE discounts ADD COLUMN bogo_get_discount_percent int DEFAULT 100;

-- 3. Add tiered pricing configuration (JSONB for flexibility)
ALTER TABLE discounts ADD COLUMN tiers jsonb;
-- Example: [{"min_quantity": 3, "max_quantity": 5, "discount_percent": 10}, ...]

-- 4. Add eligibility rules
ALTER TABLE discounts ADD COLUMN min_purchase_amount_idr int DEFAULT 0;
ALTER TABLE discounts ADD COLUMN min_item_count int DEFAULT 0;
ALTER TABLE discounts ADD COLUMN max_discount_amount_idr int; -- Cap discount amount
ALTER TABLE discounts ADD COLUMN eligibility_rule text DEFAULT 'all'
    CHECK (eligibility_rule IN ('all', 'first_order_only', 'user_tier', 'autoship_only'));

-- 5. Add coupon code support
ALTER TABLE discounts ADD COLUMN code text UNIQUE;
ALTER TABLE discounts ADD COLUMN requires_code boolean DEFAULT false;
CREATE INDEX idx_discounts_code ON discounts(code) WHERE code IS NOT NULL;

-- 6. Add usage tracking
ALTER TABLE discounts ADD COLUMN max_uses int; -- Total usage limit
ALTER TABLE discounts ADD COLUMN current_uses int DEFAULT 0;
ALTER TABLE discounts ADD COLUMN max_uses_per_user int DEFAULT 1;

-- 7. Add priority (for conflict resolution)
ALTER TABLE discounts ADD COLUMN priority int DEFAULT 0;
CREATE INDEX idx_discounts_priority ON discounts(priority DESC) WHERE active = true;

-- 8. Enhance stack_policy
ALTER TABLE discounts DROP CONSTRAINT discounts_stack_policy_check;
ALTER TABLE discounts ADD CONSTRAINT discounts_stack_policy_check
    CHECK (stack_policy IN ('best_only', 'stack_with_autoship', 'stack_all', 'exclusive'));

-- 9. Fix discount_targets (remove deprecated product_variant_id)
ALTER TABLE discount_targets DROP COLUMN product_variant_id;

-- 10. Add tag-based targeting
ALTER TABLE discount_targets ADD COLUMN tag_id uuid REFERENCES product_tags(id) ON DELETE CASCADE;

-- 11. Update constraint to include tag_id
ALTER TABLE discount_targets DROP CONSTRAINT discount_targets_check;
ALTER TABLE discount_targets ADD CONSTRAINT discount_targets_check CHECK (
    (product_id IS NOT NULL)::int +
    (category IS NOT NULL)::int +
    (tag_id IS NOT NULL)::int +
    (applies_to_all_products = true)::int = 1
);

-- 12. Create discount usage tracking table
CREATE TABLE discount_uses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    used_at timestamptz DEFAULT NOW(),
    discount_amount_idr int NOT NULL
);

CREATE INDEX idx_discount_uses_discount ON discount_uses(discount_id);
CREATE INDEX idx_discount_uses_user ON discount_uses(user_id);
CREATE INDEX idx_discount_uses_order ON discount_uses(order_id);

-- 13. Add function to check user usage limit
CREATE OR REPLACE FUNCTION check_discount_user_limit(
    p_discount_id uuid,
    p_user_id uuid
) RETURNS boolean AS $$
DECLARE
    v_max_uses_per_user int;
    v_current_user_uses int;
BEGIN
    SELECT max_uses_per_user INTO v_max_uses_per_user
    FROM discounts
    WHERE id = p_discount_id;

    IF v_max_uses_per_user IS NULL THEN
        RETURN true; -- No limit
    END IF;

    SELECT COUNT(*) INTO v_current_user_uses
    FROM discount_uses
    WHERE discount_id = p_discount_id AND user_id = p_user_id;

    RETURN v_current_user_uses < v_max_uses_per_user;
END;
$$ LANGUAGE plpgsql;
```

### Order Items Discount Breakdown

```sql
-- Add to order_items table (if not exists)
ALTER TABLE order_items ADD COLUMN discount_breakdown jsonb;

-- Example structure:
{
  "discounts_applied": [
    {
      "discount_id": "uuid",
      "discount_name": "Autoship 10%",
      "discount_type": "percentage",
      "discount_value": 10,
      "amount_saved_idr": 25000
    },
    {
      "discount_id": "uuid",
      "discount_name": "SUMMER20",
      "discount_type": "percentage",
      "discount_value": 20,
      "amount_saved_idr": 50000
    }
  ],
  "total_discount_idr": 75000,
  "base_price_idr": 250000,
  "final_price_idr": 175000
}
```

---

## Discount Rules Engine

### Architecture

```
Product Price Request
    ↓
1. Fetch Base Price (products.base_price_idr)
    ↓
2. Find Applicable Discounts
   - Check active status
   - Check date range
   - Check targeting (product/category/tag/all)
   - Check eligibility (first order, user tier, etc.)
   - Check usage limits
    ↓
3. Apply Discount Logic
   - Compute discount amount per rule
   - Handle BOGO, tiered, etc.
    ↓
4. Apply Stacking Policy
   - Sort by priority
   - Filter based on stack_policy
   - Combine or pick best
    ↓
5. Return Final Price
   - base_price_idr
   - discounts_applied[]
   - total_discount_idr
   - final_price_idr
```

### Discount Discovery Query

```sql
-- Find all applicable discounts for a product
CREATE OR REPLACE FUNCTION find_applicable_discounts(
    p_product_id uuid,
    p_user_id uuid DEFAULT NULL,
    p_is_autoship boolean DEFAULT false,
    p_is_first_order boolean DEFAULT false,
    p_quantity int DEFAULT 1,
    p_cart_total_idr int DEFAULT 0
) RETURNS TABLE (
    discount_id uuid,
    name text,
    discount_type text,
    discount_value numeric,
    priority int,
    stack_policy text
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        d.id,
        d.name,
        d.discount_type,
        d.discount_value,
        d.priority,
        d.stack_policy
    FROM discounts d
    LEFT JOIN discount_targets dt ON dt.discount_id = d.id
    LEFT JOIN products p ON p.id = p_product_id
    LEFT JOIN product_tag_assignments pta ON pta.product_id = p.id
    WHERE
        -- Discount is active
        d.active = true
        -- Within date range
        AND (d.start_date IS NULL OR d.start_date <= NOW())
        AND (d.end_date IS NULL OR d.end_date >= NOW())
        -- Not exceeded max uses
        AND (d.max_uses IS NULL OR d.current_uses < d.max_uses)
        -- Targeting matches
        AND (
            dt.applies_to_all_products = true
            OR dt.product_id = p_product_id
            OR dt.category = p.category
            OR dt.tag_id = pta.tag_id
        )
        -- Eligibility rules
        AND (
            d.eligibility_rule = 'all'
            OR (d.eligibility_rule = 'first_order_only' AND p_is_first_order)
            OR (d.eligibility_rule = 'autoship_only' AND p_is_autoship)
            -- Add user_tier check when implemented
        )
        -- Minimum purchase requirements
        AND (d.min_purchase_amount_idr = 0 OR p_cart_total_idr >= d.min_purchase_amount_idr)
        -- User usage limit (if user_id provided)
        AND (
            p_user_id IS NULL
            OR d.max_uses_per_user IS NULL
            OR check_discount_user_limit(d.id, p_user_id)
        )
        -- Autoship kind filter
        AND (
            d.kind = 'promo'
            OR (d.kind = 'autoship' AND p_is_autoship)
        )
    ORDER BY d.priority DESC, d.discount_value DESC;
END;
$$ LANGUAGE plpgsql;
```

### Discount Calculation Functions

```sql
-- Calculate percentage discount
CREATE OR REPLACE FUNCTION calc_percentage_discount(
    p_base_price_idr int,
    p_discount_value numeric,
    p_max_discount_idr int DEFAULT NULL
) RETURNS int AS $$
DECLARE
    v_discount_amount int;
BEGIN
    v_discount_amount := ROUND(p_base_price_idr * (p_discount_value / 100));

    -- Apply cap if specified
    IF p_max_discount_idr IS NOT NULL AND v_discount_amount > p_max_discount_idr THEN
        v_discount_amount := p_max_discount_idr;
    END IF;

    RETURN v_discount_amount;
END;
$$ LANGUAGE plpgsql;

-- Calculate fixed amount discount
CREATE OR REPLACE FUNCTION calc_fixed_discount(
    p_base_price_idr int,
    p_discount_value int
) RETURNS int AS $$
BEGIN
    -- Cannot discount more than the price
    IF p_discount_value > p_base_price_idr THEN
        RETURN p_base_price_idr;
    END IF;

    RETURN p_discount_value;
END;
$$ LANGUAGE plpgsql;

-- Calculate BOGO discount
CREATE OR REPLACE FUNCTION calc_bogo_discount(
    p_base_price_idr int,
    p_quantity int,
    p_buy_quantity int,
    p_get_quantity int,
    p_get_discount_percent int
) RETURNS int AS $$
DECLARE
    v_eligible_sets int;
    v_free_items int;
    v_discount_amount int;
BEGIN
    -- How many complete BOGO sets?
    v_eligible_sets := p_quantity / (p_buy_quantity + p_get_quantity);

    -- How many items are discounted?
    v_free_items := v_eligible_sets * p_get_quantity;

    -- Calculate discount
    v_discount_amount := v_free_items * p_base_price_idr * (p_get_discount_percent / 100);

    RETURN ROUND(v_discount_amount);
END;
$$ LANGUAGE plpgsql;

-- Calculate tiered discount
CREATE OR REPLACE FUNCTION calc_tiered_discount(
    p_base_price_idr int,
    p_quantity int,
    p_tiers jsonb
) RETURNS int AS $$
DECLARE
    v_tier jsonb;
    v_discount_percent int;
    v_discount_amount int;
BEGIN
    -- Find applicable tier based on quantity
    FOR v_tier IN SELECT * FROM jsonb_array_elements(p_tiers)
    LOOP
        IF p_quantity >= (v_tier->>'min_quantity')::int
           AND (v_tier->>'max_quantity' IS NULL OR p_quantity <= (v_tier->>'max_quantity')::int)
        THEN
            v_discount_percent := (v_tier->>'discount_percent')::int;
            v_discount_amount := ROUND(p_base_price_idr * p_quantity * (v_discount_percent / 100));
            RETURN v_discount_amount;
        END IF;
    END LOOP;

    -- No tier matched
    RETURN 0;
END;
$$ LANGUAGE plpgsql;
```

### Main Pricing Engine Function

```sql
-- Get final price with all discounts applied
CREATE OR REPLACE FUNCTION compute_product_price(
    p_product_id uuid,
    p_user_id uuid DEFAULT NULL,
    p_is_autoship boolean DEFAULT false,
    p_quantity int DEFAULT 1,
    p_cart_total_idr int DEFAULT 0,
    p_coupon_code text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_base_price_idr int;
    v_product_name text;
    v_applicable_discounts RECORD;
    v_discounts_to_apply jsonb := '[]'::jsonb;
    v_discount_amount int;
    v_total_discount_idr int := 0;
    v_final_price_idr int;
    v_is_first_order boolean;
    v_autoship_applied boolean := false;
    v_promo_applied boolean := false;
BEGIN
    -- 1. Get base price
    SELECT base_price_idr, name INTO v_base_price_idr, v_product_name
    FROM products
    WHERE id = p_product_id;

    IF v_base_price_idr IS NULL THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    -- 2. Check if first order (if user provided)
    IF p_user_id IS NOT NULL THEN
        SELECT NOT EXISTS(
            SELECT 1 FROM orders WHERE user_id = p_user_id
        ) INTO v_is_first_order;
    ELSE
        v_is_first_order := false;
    END IF;

    -- 3. Find applicable discounts
    FOR v_applicable_discounts IN
        SELECT * FROM find_applicable_discounts(
            p_product_id,
            p_user_id,
            p_is_autoship,
            v_is_first_order,
            p_quantity,
            p_cart_total_idr
        )
    LOOP
        -- 4. Calculate discount amount based on type
        v_discount_amount := 0;

        CASE v_applicable_discounts.discount_type
            WHEN 'percentage' THEN
                v_discount_amount := calc_percentage_discount(
                    v_base_price_idr * p_quantity,
                    v_applicable_discounts.discount_value,
                    NULL -- max_discount_idr (fetch from discounts table if needed)
                );

            WHEN 'fixed_amount' THEN
                v_discount_amount := calc_fixed_discount(
                    v_base_price_idr * p_quantity,
                    v_applicable_discounts.discount_value::int
                );

            WHEN 'bogo' THEN
                -- Fetch BOGO config from discounts table
                SELECT calc_bogo_discount(
                    v_base_price_idr,
                    p_quantity,
                    bogo_buy_quantity,
                    bogo_get_quantity,
                    bogo_get_discount_percent
                ) INTO v_discount_amount
                FROM discounts
                WHERE id = v_applicable_discounts.discount_id;

            WHEN 'tiered' THEN
                -- Fetch tiers from discounts table
                SELECT calc_tiered_discount(
                    v_base_price_idr,
                    p_quantity,
                    tiers
                ) INTO v_discount_amount
                FROM discounts
                WHERE id = v_applicable_discounts.discount_id;

            ELSE
                v_discount_amount := 0;
        END CASE;

        -- 5. Apply stacking policy
        IF v_applicable_discounts.stack_policy = 'exclusive' THEN
            -- This discount excludes all others
            v_discounts_to_apply := jsonb_build_array(
                jsonb_build_object(
                    'discount_id', v_applicable_discounts.discount_id,
                    'name', v_applicable_discounts.name,
                    'type', v_applicable_discounts.discount_type,
                    'value', v_applicable_discounts.discount_value,
                    'amount_idr', v_discount_amount
                )
            );
            v_total_discount_idr := v_discount_amount;
            EXIT; -- Stop processing other discounts

        ELSIF v_applicable_discounts.stack_policy = 'best_only' THEN
            -- Only keep the best single discount
            IF v_discount_amount > v_total_discount_idr THEN
                v_discounts_to_apply := jsonb_build_array(
                    jsonb_build_object(
                        'discount_id', v_applicable_discounts.discount_id,
                        'name', v_applicable_discounts.name,
                        'type', v_applicable_discounts.discount_type,
                        'value', v_applicable_discounts.discount_value,
                        'amount_idr', v_discount_amount
                    )
                );
                v_total_discount_idr := v_discount_amount;
            END IF;

        ELSIF v_applicable_discounts.stack_policy = 'stack_with_autoship' THEN
            -- Stack autoship with one promo
            -- TODO: Implement logic to allow autoship + best promo

        ELSIF v_applicable_discounts.stack_policy = 'stack_all' THEN
            -- Stack all discounts
            v_discounts_to_apply := v_discounts_to_apply || jsonb_build_object(
                'discount_id', v_applicable_discounts.discount_id,
                'name', v_applicable_discounts.name,
                'type', v_applicable_discounts.discount_type,
                'value', v_applicable_discounts.discount_value,
                'amount_idr', v_discount_amount
            );
            v_total_discount_idr := v_total_discount_idr + v_discount_amount;
        END IF;
    END LOOP;

    -- 6. Calculate final price
    v_final_price_idr := (v_base_price_idr * p_quantity) - v_total_discount_idr;

    -- Ensure final price is never negative
    IF v_final_price_idr < 0 THEN
        v_final_price_idr := 0;
    END IF;

    -- 7. Return pricing breakdown
    RETURN jsonb_build_object(
        'product_id', p_product_id,
        'product_name', v_product_name,
        'quantity', p_quantity,
        'base_price_idr', v_base_price_idr,
        'base_total_idr', v_base_price_idr * p_quantity,
        'discounts_applied', v_discounts_to_apply,
        'total_discount_idr', v_total_discount_idr,
        'final_price_idr', v_final_price_idr,
        'savings_percent', CASE
            WHEN v_base_price_idr * p_quantity > 0
            THEN ROUND((v_total_discount_idr::numeric / (v_base_price_idr * p_quantity)) * 100, 2)
            ELSE 0
        END
    );
END;
$$ LANGUAGE plpgsql;
```

---

## Stacking Logic

### Stack Policies Explained

#### 1. **Exclusive**
Only this discount applies, all others ignored.

**Example**: Black Friday 50% off (excludes all other discounts)

**Logic**:
```typescript
if (discount.stack_policy === 'exclusive') {
  return [discount] // Only this one
}
```

#### 2. **Best Only**
Apply the single best discount.

**Example**: Customer has 10% welcome discount and 15% category sale → Apply 15%

**Logic**:
```typescript
const bestDiscount = discounts.reduce((best, current) =>
  current.amount > best.amount ? current : best
)
return [bestDiscount]
```

#### 3. **Stack with Autoship**
Autoship discount + best promo discount.

**Example**: 10% autoship + 20% sale = 30% total (or apply sequentially)

**Logic**:
```typescript
const autoship = discounts.find(d => d.kind === 'autoship')
const promos = discounts.filter(d => d.kind === 'promo')
const bestPromo = promos.reduce((best, current) =>
  current.amount > best.amount ? current : best
)
return [autoship, bestPromo].filter(Boolean)
```

**Calculation Methods**:

A. **Additive** (Simple but generous):
```
Base: Rp 100,000
Autoship 10%: -Rp 10,000
Promo 20%: -Rp 20,000
Total: Rp 70,000 (30% total discount)
```

B. **Sequential** (More conservative):
```
Base: Rp 100,000
Autoship 10%: Rp 90,000
Promo 20% on Rp 90,000: -Rp 18,000
Total: Rp 72,000 (28% total discount)
```

**Recommendation**: Use **Sequential** (industry standard)

#### 4. **Stack All**
All applicable discounts combine.

**Example**: 10% loyalty + 5% email signup + 15% sale = 30% total

**Risk**: Can lead to excessive discounts, use with caution

**Logic**:
```typescript
const totalDiscount = discounts.reduce((sum, d) => sum + d.amount, 0)
// Optionally cap at max (e.g., 50%)
const cappedDiscount = Math.min(totalDiscount, basePrice * 0.5)
```

### Stacking Decision Tree

```
┌─────────────────────────────────────┐
│ Find Applicable Discounts           │
└────────────┬────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Any Exclusive?│
      └──────┬───────┘
             │
         Yes │    No
             ▼      │
      ┌──────────┐  │
      │ Use Only │  │
      │ Exclusive│  │
      └──────────┘  │
                    ▼
             ┌──────────────┐
             │ Has Autoship?│
             └──────┬───────┘
                    │
                Yes │    No
                    ▼      │
         ┌──────────────┐  │
         │ Stack Policy │  │
         │ = stack_with │  │
         │   _autoship? │  │
         └──────┬───────┘  │
                │          │
            Yes │    No    │
                ▼      │   │
    ┌──────────────┐  │   │
    │ Autoship +   │  │   │
    │ Best Promo   │  │   │
    └──────────────┘  │   │
                      ▼   ▼
               ┌──────────────┐
               │ Best Only or │
               │ Stack All?   │
               └──────┬───────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   ┌──────────┐             ┌──────────┐
   │Best Only │             │Stack All │
   └──────────┘             └──────────┘
```

---

## Implementation Guide

### Phase 3A: Schema Migration

**File**: `supabase/migrations/0014_enhance_discounts.sql`

See "Schema Enhancements Needed" section above.

**Steps**:
1. Create migration file
2. Test locally with sample data
3. Apply to staging
4. Verify discount queries work
5. Apply to production

### Phase 3B: Pricing Engine Functions

**File**: `supabase/migrations/0015_pricing_engine.sql`

Copy all SQL functions from "Discount Rules Engine" section.

**Testing**:
```sql
-- Test percentage discount
SELECT compute_product_price(
  'product-uuid',
  'user-uuid',
  false, -- not autoship
  1,     -- quantity
  0,     -- cart total
  NULL   -- no coupon
);

-- Test autoship discount
SELECT compute_product_price(
  'product-uuid',
  'user-uuid',
  true, -- IS autoship
  2,
  0,
  NULL
);

-- Test with coupon
SELECT compute_product_price(
  'product-uuid',
  'user-uuid',
  false,
  1,
  0,
  'WELCOME20'
);
```

### Phase 3C: Edge Function for Cart Pricing

**File**: `supabase/functions/compute-cart-price/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

interface CartItem {
  product_id: string
  quantity: number
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Authenticate
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  // Parse request
  const {
    items,
    is_autoship = false,
    coupon_code = null
  }: {
    items: CartItem[]
    is_autoship?: boolean
    coupon_code?: string | null
  } = await req.json()

  // Compute price for each item
  const itemPrices = []
  let cartSubtotal = 0

  for (const item of items) {
    const { data: priceData } = await supabase.rpc('compute_product_price', {
      p_product_id: item.product_id,
      p_user_id: user?.id || null,
      p_is_autoship: is_autoship,
      p_quantity: item.quantity,
      p_cart_total_idr: 0, // Will compute after first pass
      p_coupon_code: coupon_code,
    })

    itemPrices.push(priceData)
    cartSubtotal += priceData.base_total_idr
  }

  // Second pass: apply cart-level discounts
  // (Re-compute with actual cart total for min_purchase requirements)
  const finalItems = []
  let totalDiscount = 0
  let finalTotal = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const { data: priceData } = await supabase.rpc('compute_product_price', {
      p_product_id: item.product_id,
      p_user_id: user?.id || null,
      p_is_autoship: is_autoship,
      p_quantity: item.quantity,
      p_cart_total_idr: cartSubtotal,
      p_coupon_code: coupon_code,
    })

    finalItems.push(priceData)
    totalDiscount += priceData.total_discount_idr
    finalTotal += priceData.final_price_idr
  }

  // Return cart summary
  return new Response(JSON.stringify({
    items: finalItems,
    subtotal_idr: cartSubtotal,
    total_discount_idr: totalDiscount,
    final_total_idr: finalTotal,
    savings_percent: cartSubtotal > 0
      ? Math.round((totalDiscount / cartSubtotal) * 100 * 100) / 100
      : 0
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Phase 3D: Admin UI for Discounts

See "Admin UI" section below.

---

## API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/discounts` | GET | List all discounts (admin) | Admin |
| `/api/discounts` | POST | Create discount | Admin |
| `/api/discounts/:id` | GET | Get discount details | Admin |
| `/api/discounts/:id` | PATCH | Update discount | Admin |
| `/api/discounts/:id` | DELETE | Delete discount | Admin |
| `/api/discounts/validate-code` | POST | Validate coupon code | Public |
| `/api/pricing/product` | POST | Get product price | Public |
| `/api/pricing/cart` | POST | Get cart total price | User |

---

## Admin UI

### Discount List Page

**Route**: `/admin/discounts`

**Features**:
- Table view of all discounts
- Filter by status (active/inactive)
- Filter by kind (promo/autoship)
- Search by name or code
- Sort by priority, created date
- Quick actions: Activate/Deactivate, Delete
- Create New button

**Table Columns**:
| Column | Description |
|--------|-------------|
| Name | Discount name + badge (ACTIVE/INACTIVE) |
| Code | Coupon code (if requires_code) |
| Type | Percentage, Fixed Amount, BOGO, Tiered |
| Value | Discount value (%, Rp, or config) |
| Targets | Products (count), Categories, Tags, All |
| Dates | Start - End (or "No expiration") |
| Uses | Current / Max |
| Priority | Numeric priority |
| Actions | Edit, Deactivate, Delete |

### Create/Edit Discount Form

**Route**: `/admin/discounts/new`, `/admin/discounts/:id/edit`

**Form Sections**:

1. **Basic Info**
   - Name (required)
   - Description (optional)
   - Kind: Promo or Autoship
   - Active toggle

2. **Discount Type**
   - Radio buttons: Percentage, Fixed Amount, BOGO, Tiered, Free Shipping
   - Dynamic fields based on selection:
     - **Percentage**: Value (%), Max Discount (Rp, optional)
     - **Fixed Amount**: Value (Rp)
     - **BOGO**: Buy X, Get Y, Discount % on free items
     - **Tiered**: Add tier rows (Min Qty, Max Qty, Discount %)
     - **Free Shipping**: No value needed

3. **Targeting**
   - Radio buttons: All Products, Specific Products, Category, Tags
   - Dynamic selector based on choice:
     - **Specific Products**: Multi-select product picker
     - **Category**: Dropdown (or text input if categories not enum)
     - **Tags**: Multi-select tag picker

4. **Eligibility**
   - Eligibility Rule: All, First Order Only, Autoship Only, User Tier
   - Min Purchase Amount (Rp)
   - Min Item Count

5. **Coupon Code**
   - Requires Code toggle
   - Code input (auto-generate button)
   - Case sensitivity note

6. **Usage Limits**
   - Max Total Uses (optional)
   - Max Uses Per User (default: 1)

7. **Dates**
   - Start Date (optional)
   - End Date (optional)
   - Timezone: Asia/Jakarta

8. **Stacking Policy**
   - Dropdown: Best Only, Stack with Autoship, Stack All, Exclusive
   - Help text explaining each

9. **Priority**
   - Number input (higher = higher priority)
   - Help text: "Used to resolve conflicts when multiple discounts apply"

**Validation**:
- Name required
- Discount value > 0
- At least one target selected
- End date after start date
- BOGO: buy_quantity + get_quantity > 0
- Tiered: At least one tier, no overlapping ranges
- Code: Unique, alphanumeric + hyphens only

### Discount Analytics Dashboard

**Route**: `/admin/discounts/:id/analytics`

**Metrics**:
- Total uses
- Total discount given (Rp)
- Unique users
- Revenue attributed (orders using this discount)
- Conversion rate (users who saw discount vs used it)
- Top products (what products were bought with this discount)

**Charts**:
- Usage over time (line chart)
- Discount amount distribution (histogram)
- User segmentation (first-time vs repeat)

---

## Testing Strategy

### Unit Tests

```typescript
// Test: find_applicable_discounts
describe('find_applicable_discounts', () => {
  it('returns active discounts only', async () => {
    await createDiscount({ name: 'Active', active: true })
    await createDiscount({ name: 'Inactive', active: false })

    const result = await findApplicableDiscounts(productId)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Active')
  })

  it('respects date range', async () => {
    await createDiscount({
      name: 'Future',
      start_date: addDays(new Date(), 1)
    })

    const result = await findApplicableDiscounts(productId)

    expect(result).toHaveLength(0) // Not started yet
  })

  it('checks user usage limit', async () => {
    const discount = await createDiscount({ max_uses_per_user: 1 })
    await useDiscount(discount.id, userId) // First use

    const canUse = await checkDiscountUserLimit(discount.id, userId)

    expect(canUse).toBe(false) // Already used once
  })
})

// Test: compute_product_price
describe('compute_product_price', () => {
  it('applies percentage discount correctly', async () => {
    await createProduct({ base_price_idr: 100000 })
    await createDiscount({ type: 'percentage', value: 10, applies_to_all: true })

    const result = await computeProductPrice(productId)

    expect(result.base_total_idr).toBe(100000)
    expect(result.total_discount_idr).toBe(10000)
    expect(result.final_price_idr).toBe(90000)
  })

  it('applies best-only policy', async () => {
    await createProduct({ base_price_idr: 100000 })
    await createDiscount({ type: 'percentage', value: 10, stack_policy: 'best_only' })
    await createDiscount({ type: 'percentage', value: 20, stack_policy: 'best_only' })

    const result = await computeProductPrice(productId)

    expect(result.discounts_applied).toHaveLength(1)
    expect(result.total_discount_idr).toBe(20000) // Best: 20%
  })

  it('stacks autoship with promo', async () => {
    await createProduct({ base_price_idr: 100000 })
    await createDiscount({ kind: 'autoship', type: 'percentage', value: 10 })
    await createDiscount({ kind: 'promo', type: 'percentage', value: 15, stack_policy: 'stack_with_autoship' })

    const result = await computeProductPrice(productId, userId, true) // is_autoship = true

    expect(result.discounts_applied).toHaveLength(2)
    // Sequential: 100k - 10% = 90k, 90k - 15% = 76.5k
    expect(result.final_price_idr).toBeCloseTo(76500, -2)
  })

  it('applies BOGO discount', async () => {
    await createProduct({ base_price_idr: 100000 })
    await createDiscount({
      type: 'bogo',
      bogo_buy_quantity: 2,
      bogo_get_quantity: 1,
      bogo_get_discount_percent: 100
    })

    const result = await computeProductPrice(productId, null, false, 3) // Buy 3

    // Buy 2, get 1 free = 100k discount
    expect(result.total_discount_idr).toBe(100000)
    expect(result.final_price_idr).toBe(200000) // Pay for 2
  })

  it('applies tiered discount', async () => {
    await createProduct({ base_price_idr: 100000 })
    await createDiscount({
      type: 'tiered',
      tiers: [
        { min_quantity: 1, max_quantity: 2, discount_percent: 0 },
        { min_quantity: 3, max_quantity: 5, discount_percent: 10 },
        { min_quantity: 6, max_quantity: null, discount_percent: 20 }
      ]
    })

    const result = await computeProductPrice(productId, null, false, 4) // Buy 4

    // 4 items * 100k = 400k, 10% off = 40k discount
    expect(result.total_discount_idr).toBe(40000)
    expect(result.final_price_idr).toBe(360000)
  })
})
```

### Integration Tests

```typescript
// Test: Full discount flow from admin creation to user checkout
it('creates discount and applies to order', async () => {
  const admin = await createAdminUser()
  const user = await createUser()
  const product = await createProduct({ base_price_idr: 100000 })

  // Admin creates 20% discount
  const response = await fetch('/api/discounts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${admin.token}` },
    body: JSON.stringify({
      name: '20% Off',
      kind: 'promo',
      discount_type: 'percentage',
      discount_value: 20,
      applies_to_all_products: true,
      active: true
    })
  })

  expect(response.status).toBe(201)

  // User computes cart price
  const priceResponse = await fetch('/api/pricing/cart', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${user.token}` },
    body: JSON.stringify({
      items: [{ product_id: product.id, quantity: 1 }]
    })
  })

  const priceData = await priceResponse.json()
  expect(priceData.final_total_idr).toBe(80000) // 20% off 100k
})
```

---

## Success Metrics

Track these KPIs:

**Discount Performance**:
- Conversion rate (users who saw discount vs bought)
- Average order value (with vs without discount)
- Discount usage rate (uses / views)
- Revenue per discount (attributed sales)

**Business Impact**:
- Margin erosion (total discounts / total revenue)
- Customer acquisition cost (CAC) with first-order discounts
- Lifetime value (LTV) of discount users vs non-discount users

**SQL Queries**:

```sql
-- Discount usage by month
SELECT
  DATE_TRUNC('month', used_at) as month,
  d.name,
  COUNT(*) as uses,
  SUM(discount_amount_idr) as total_discount_idr
FROM discount_uses du
JOIN discounts d ON d.id = du.discount_id
WHERE used_at >= NOW() - INTERVAL '6 months'
GROUP BY month, d.name
ORDER BY month DESC, total_discount_idr DESC;

-- Margin erosion
SELECT
  (SUM(total_discount_idr) * 100.0 / SUM(subtotal_idr))::numeric(10,2) as margin_erosion_percent
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days';
```

---

## Appendix

### Example Discount Configurations

**1. Welcome Discount**:
```json
{
  "name": "Welcome 30% Off",
  "kind": "promo",
  "discount_type": "percentage",
  "discount_value": 30,
  "eligibility_rule": "first_order_only",
  "max_uses_per_user": 1,
  "applies_to_all_products": true,
  "active": true
}
```

**2. Category Sale**:
```json
{
  "name": "Dog Food 20% Off",
  "kind": "promo",
  "discount_type": "percentage",
  "discount_value": 20,
  "targets": [{ "category": "dog-food" }],
  "start_date": "2026-01-15T00:00:00Z",
  "end_date": "2026-01-31T23:59:59Z",
  "active": true
}
```

**3. Free Shipping**:
```json
{
  "name": "Free Shipping Over Rp 300k",
  "kind": "promo",
  "discount_type": "free_shipping",
  "min_purchase_amount_idr": 300000,
  "applies_to_all_products": true,
  "active": true
}
```

**4. BOGO**:
```json
{
  "name": "Buy 2 Get 1 Free - Cat Treats",
  "kind": "promo",
  "discount_type": "bogo",
  "bogo_buy_quantity": 2,
  "bogo_get_quantity": 1,
  "bogo_get_discount_percent": 100,
  "targets": [{ "tag_id": "cat-treats-tag-uuid" }],
  "active": true
}
```

**5. Autoship**:
```json
{
  "name": "Autoship 10% Savings",
  "kind": "autoship",
  "discount_type": "percentage",
  "discount_value": 10,
  "applies_to_all_products": true,
  "stack_policy": "stack_with_autoship",
  "active": true
}
```

---

**Document Status**: ✅ Complete
**Implementation Status**: ⏳ Not Started (Phase 3)
**Next Steps**: Implement pricing engine, then admin UI
