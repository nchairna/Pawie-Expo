-- Migration: 0016_pricing_test_data.sql
-- Purpose: Seed test discounts for Phase 3 development and validation
-- Date: 2026-01-08
-- Note: This migration can be run multiple times safely (uses IF NOT EXISTS logic)

-- ============================================================================
-- Test Scenario 1: Global Autoship Discount (10% off all autoship-eligible products)
-- ============================================================================

DO $$
DECLARE
  v_autoship_discount_id uuid;
BEGIN
  -- Check if global autoship discount already exists
  SELECT id INTO v_autoship_discount_id
  FROM public.discounts
  WHERE kind = 'autoship' 
    AND active = true
    AND EXISTS (
      SELECT 1 FROM public.discount_targets 
      WHERE discount_id = discounts.id 
      AND applies_to_all_products = true
    )
  LIMIT 1;

  -- Only create if it doesn't exist
  IF v_autoship_discount_id IS NULL THEN
    INSERT INTO public.discounts (
      name, 
      kind, 
      discount_type, 
      value, 
      active, 
      stack_policy
    )
    VALUES (
      'Autoship 10% Off',
      'autoship',
      'percentage',
      10,
      true,
      'stack'
    )
    RETURNING id INTO v_autoship_discount_id;

    -- Create target for all products
    INSERT INTO public.discount_targets (
      discount_id,
      applies_to_all_products
    )
    VALUES (
      v_autoship_discount_id,
      true
    );
  END IF;
END $$;

-- ============================================================================
-- Test Scenario 2: Product-Specific Promo (15% off specific product)
-- ============================================================================

-- Note: This requires a real product_id. We'll create a placeholder that
-- can be updated later, or skip if no products exist yet.
-- For now, we'll create the discount but leave the target empty
-- (admin can assign products via UI)

DO $$
DECLARE
  v_promo_discount_id uuid;
  v_sample_product_id uuid;
BEGIN
  -- Try to find a published product to use as example
  SELECT id INTO v_sample_product_id
  FROM public.products
  WHERE published = true
  LIMIT 1;

  -- Check if this promo discount already exists
  SELECT id INTO v_promo_discount_id
  FROM public.discounts
  WHERE name = 'Royal Canin Sale'
  LIMIT 1;

  -- Only create if it doesn't exist
  IF v_promo_discount_id IS NULL THEN
    INSERT INTO public.discounts (
      name,
      kind,
      discount_type,
      value,
      active,
      stack_policy
    )
    VALUES (
      'Royal Canin Sale',
      'promo',
      'percentage',
      15,
      true,
      'best_only'
    )
    RETURNING id INTO v_promo_discount_id;

    -- Only create target if we have a product
    IF v_sample_product_id IS NOT NULL THEN
      INSERT INTO public.discount_targets (
        discount_id,
        product_id
      )
      VALUES (
        v_promo_discount_id,
        v_sample_product_id
      );
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Test Scenario 3: Fixed Discount (5000 IDR off all products)
-- ============================================================================

DO $$
DECLARE
  v_fixed_discount_id uuid;
BEGIN
  -- Check if this discount already exists
  SELECT id INTO v_fixed_discount_id
  FROM public.discounts
  WHERE name = '5K Off'
  LIMIT 1;

  -- Only create if it doesn't exist
  IF v_fixed_discount_id IS NULL THEN
    INSERT INTO public.discounts (
      name,
      kind,
      discount_type,
      value,
      active,
      stack_policy
    )
    VALUES (
      '5K Off',
      'promo',
      'fixed',
      5000,
      true,
      'stack'
    )
    RETURNING id INTO v_fixed_discount_id;

    -- Create target for all products
    INSERT INTO public.discount_targets (
      discount_id,
      applies_to_all_products
    )
    VALUES (
      v_fixed_discount_id,
      true
    );
  END IF;
END $$;

-- ============================================================================
-- Test Scenario 4: Min Order Threshold (10% off orders over 200000)
-- ============================================================================

DO $$
DECLARE
  v_threshold_discount_id uuid;
BEGIN
  -- Check if this discount already exists
  SELECT id INTO v_threshold_discount_id
  FROM public.discounts
  WHERE name = '10% Off 200K+'
  LIMIT 1;

  -- Only create if it doesn't exist
  IF v_threshold_discount_id IS NULL THEN
    INSERT INTO public.discounts (
      name,
      kind,
      discount_type,
      value,
      active,
      min_order_subtotal_idr,
      stack_policy
    )
    VALUES (
      '10% Off 200K+',
      'promo',
      'percentage',
      10,
      true,
      200000,
      'best_only'
    )
    RETURNING id INTO v_threshold_discount_id;

    -- Create target for all products
    INSERT INTO public.discount_targets (
      discount_id,
      applies_to_all_products
    )
    VALUES (
      v_threshold_discount_id,
      true
    );
  END IF;
END $$;

-- ============================================================================
-- Validation Queries (for manual testing)
-- ============================================================================

-- Uncomment and run these queries in Supabase SQL Editor to test:

-- Test 1: One-time purchase (no autoship)
-- SELECT compute_product_price(
--   'YOUR_PRODUCT_ID_HERE'::uuid,
--   NULL,
--   false,  -- not autoship
--   1
-- );

-- Test 2: Autoship purchase
-- SELECT compute_product_price(
--   'YOUR_PRODUCT_ID_HERE'::uuid,
--   NULL,
--   true,  -- autoship
--   1
-- );

-- Test 3: Min threshold not met
-- SELECT compute_product_price(
--   'YOUR_PRODUCT_ID_HERE'::uuid,
--   NULL,
--   false,
--   1,
--   50000  -- cart total below threshold
-- );

-- Test 4: Min threshold met
-- SELECT compute_product_price(
--   'YOUR_PRODUCT_ID_HERE'::uuid,
--   NULL,
--   false,
--   1,
--   250000  -- cart total above threshold
-- );

-- Test 5: Stacking (autoship + promo)
-- SELECT compute_product_price(
--   'YOUR_PRODUCT_ID_HERE'::uuid,
--   NULL,
--   true,  -- autoship
--   1,
--   250000  -- cart total above threshold
-- );

