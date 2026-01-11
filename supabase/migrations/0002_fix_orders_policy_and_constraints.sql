-- Migration: Fix Orders INSERT Policy and Add Validation Constraints
-- Date: 2026-01-03
-- Purpose: Enable order creation and add data integrity constraints

-- ============================================================================
-- UPDATE EXISTING DATA TO MATCH CONSTRAINTS
-- ============================================================================

-- Fix discount_type: "percent" -> "percentage"
UPDATE public.discounts
SET discount_type = 'percentage'
WHERE discount_type = 'percent';

-- Fix stack_policy: "stack_with_autoship" -> "stack"
UPDATE public.discounts
SET stack_policy = 'stack'
WHERE stack_policy = 'stack_with_autoship';

-- ============================================================================
-- ORDERS INSERT POLICY
-- ============================================================================

-- Allow authenticated users to create their own orders
-- Note: Edge Functions using service role key will bypass RLS anyway,
-- but this policy allows direct client-side creation if needed
CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- VALIDATION CONSTRAINTS
-- ============================================================================

-- Orders status constraint
ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- Orders source constraint
ALTER TABLE public.orders
    ADD CONSTRAINT orders_source_check 
    CHECK (source IN ('one_time', 'autoship'));

-- Autoships status constraint
ALTER TABLE public.autoships
    ADD CONSTRAINT autoships_status_check 
    CHECK (status IN ('active', 'paused', 'cancelled'));

-- Autoship runs status constraint
ALTER TABLE public.autoship_runs
    ADD CONSTRAINT autoship_runs_status_check 
    CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled'));

-- Discounts discount_type constraint
ALTER TABLE public.discounts
    ADD CONSTRAINT discounts_discount_type_check 
    CHECK (discount_type IN ('percentage', 'fixed'));

-- Discounts kind constraint
ALTER TABLE public.discounts
    ADD CONSTRAINT discounts_kind_check 
    CHECK (kind IN ('autoship', 'promo', 'first_time', 'category', 'product', 'cart'));

-- Discounts stack_policy constraint
ALTER TABLE public.discounts
    ADD CONSTRAINT discounts_stack_policy_check 
    CHECK (stack_policy IN ('best_only', 'stack', 'first_only'));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT orders_status_check ON public.orders IS 
    'Valid order statuses: pending, paid, processing, shipped, delivered, cancelled, refunded';

COMMENT ON CONSTRAINT orders_source_check ON public.orders IS 
    'Order source: one_time (regular purchase) or autoship (subscription order)';

COMMENT ON CONSTRAINT autoships_status_check ON public.autoships IS 
    'Autoship status: active (running), paused (temporarily stopped), cancelled (permanently stopped)';

COMMENT ON CONSTRAINT autoship_runs_status_check ON public.autoship_runs IS 
    'Autoship run status: scheduled, processing, completed, failed, cancelled';

COMMENT ON CONSTRAINT discounts_discount_type_check ON public.discounts IS 
    'Discount type: percentage (e.g., 10%) or fixed (e.g., Rp 10,000 off)';

COMMENT ON CONSTRAINT discounts_kind_check ON public.discounts IS 
    'Discount kind: autoship, promo, first_time, category, product, or cart-level';

COMMENT ON CONSTRAINT discounts_stack_policy_check ON public.discounts IS 
    'Stacking policy: best_only (apply best discount), stack (combine discounts), first_only (apply first eligible)';

