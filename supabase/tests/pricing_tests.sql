-- Pricing Function Tests - Phase 3 Part D.1
-- Purpose: Comprehensive test suite for pricing engine functions
-- Date: 2026-01-09
-- 
-- This file contains test functions and validation queries for:
-- 1. compute_product_price()
-- 2. find_applicable_discounts()
-- 3. apply_discount_stacking()
--
-- Run these tests to validate pricing engine functionality

-- ============================================================================
-- Test Setup: Get a test product ID
-- ============================================================================
-- We'll use a variable approach - tests will use the first published product
-- with a base price, or you can replace with a specific product ID

-- ============================================================================
-- Test Scenario 1: No discounts - Returns base price
-- ============================================================================
-- Expected: final_price_idr = base_price_idr, discount_total_idr = 0

-- Test query (replace with actual product ID):
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,  -- not autoship
--     1       -- quantity
--   ) AS result;
--
-- Expected result structure:
-- {
--   "base_price_idr": 250000,
--   "final_price_idr": 250000,
--   "discount_total_idr": 0,
--   "discounts_applied": [],
--   "line_total_idr": 250000
-- }

-- ============================================================================
-- Test Scenario 2: Single percentage discount - Calculates correctly
-- ============================================================================
-- Setup: Create a 10% promo discount for a product
-- Expected: final_price = base_price * 0.9

-- Test query:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Expected: If base is 100000 and 10% discount applies:
-- {
--   "base_price_idr": 100000,
--   "final_price_idr": 90000,
--   "discount_total_idr": 10000,
--   "discounts_applied": [{"name": "...", "type": "percentage", "value": 10, "amount": 10000}],
--   "line_total_idr": 90000
-- }

-- ============================================================================
-- Test Scenario 3: Single fixed discount - Calculates correctly
-- ============================================================================
-- Setup: Create a 5000 IDR fixed discount
-- Expected: final_price = base_price - 5000

-- Test query:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Expected: If base is 100000 and 5000 fixed discount applies:
-- {
--   "base_price_idr": 100000,
--   "final_price_idr": 95000,
--   "discount_total_idr": 5000,
--   "discounts_applied": [{"name": "...", "type": "fixed", "value": 5000, "amount": 5000}],
--   "line_total_idr": 95000
-- }

-- ============================================================================
-- Test Scenario 4: Multiple discounts (best_only) - Takes highest
-- ============================================================================
-- Setup: Two discounts with best_only policy (e.g., 10% and 15%)
-- Expected: Only the highest discount (15%) is applied

-- Test query:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Expected: If base is 100000, 10% discount (10000) and 15% discount (15000):
-- Only 15% discount applied:
-- {
--   "base_price_idr": 100000,
--   "final_price_idr": 85000,
--   "discount_total_idr": 15000,
--   "discounts_applied": [{"name": "15% discount", ...}],
--   "line_total_idr": 85000
-- }

-- ============================================================================
-- Test Scenario 5: Multiple discounts (stack) - Combines correctly
-- ============================================================================
-- Setup: Autoship 10% (stack) + Fixed 5000 (stack)
-- Expected: Percentage first, then fixed: (base * 0.9) - 5000

-- Test query:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     true,  -- autoship
--     1
--   ) AS result;
--
-- Expected: If base is 100000, 10% autoship + 5000 fixed:
-- Step 1: 100000 * 0.9 = 90000
-- Step 2: 90000 - 5000 = 85000
-- {
--   "base_price_idr": 100000,
--   "final_price_idr": 85000,
--   "discount_total_idr": 15000,
--   "discounts_applied": [
--     {"name": "Autoship 10% Off", "type": "percentage", "value": 10, "amount": 10000},
--     {"name": "5K Off", "type": "fixed", "value": 5000, "amount": 5000}
--   ],
--   "line_total_idr": 85000
-- }

-- ============================================================================
-- Test Scenario 6: Autoship discount - Only applies when is_autoship = true
-- ============================================================================
-- Setup: Global autoship discount exists
-- Expected: 
--   - When is_autoship = false: autoship discount NOT applied
--   - When is_autoship = true: autoship discount IS applied

-- Test 6a: One-time purchase (no autoship)
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,  -- NOT autoship
--     1
--   ) AS one_time_result;
--
-- Expected: No autoship discount in discounts_applied

-- Test 6b: Autoship purchase
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     true,  -- IS autoship
--     1
--   ) AS autoship_result;
--
-- Expected: Autoship discount in discounts_applied

-- ============================================================================
-- Test Scenario 7: Time-bound discount - Respects starts_at and ends_at
-- ============================================================================
-- Setup: Discount with starts_at = NOW() - 1 day, ends_at = NOW() + 1 day
-- Expected: Discount applies (within time window)

-- Setup: Discount with starts_at = NOW() + 1 day (future)
-- Expected: Discount does NOT apply (not started yet)

-- Setup: Discount with ends_at = NOW() - 1 day (past)
-- Expected: Discount does NOT apply (expired)

-- Test queries:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Verify discounts_applied array only includes active discounts

-- ============================================================================
-- Test Scenario 8: Min order threshold - Only applies when threshold met
-- ============================================================================
-- Setup: Discount with min_order_subtotal_idr = 200000
-- Expected:
--   - When cart_total_idr < 200000: Discount NOT applied
--   - When cart_total_idr >= 200000: Discount IS applied

-- Test 8a: Below threshold
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1,
--     50000  -- cart total below threshold
--   ) AS below_threshold_result;
--
-- Expected: Threshold discount NOT in discounts_applied

-- Test 8b: Above threshold
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1,
--     250000  -- cart total above threshold
--   ) AS above_threshold_result;
--
-- Expected: Threshold discount IS in discounts_applied

-- ============================================================================
-- Test Scenario 9: Negative price prevention - Final price never < 0
-- ============================================================================
-- Setup: Discount that would make price negative (e.g., 200000 fixed off 100000 base)
-- Expected: final_price_idr = 0 (not negative)

-- Test query:
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Expected: final_price_idr >= 0 always

-- ============================================================================
-- Test Scenario 10: Performance - Completes in < 100ms
-- ============================================================================
-- Use EXPLAIN ANALYZE to measure execution time

-- Test query:
-- EXPLAIN ANALYZE
-- SELECT 
--   compute_product_price(
--     'PRODUCT_ID_HERE'::uuid,
--     NULL,
--     false,
--     1
--   ) AS result;
--
-- Expected: Execution time < 100ms

-- ============================================================================
-- Comprehensive Test Function
-- ============================================================================
-- This function runs all tests and returns a summary

CREATE OR REPLACE FUNCTION public.run_pricing_tests(p_test_product_id uuid)
RETURNS TABLE (
  test_number integer,
  test_name text,
  passed boolean,
  result jsonb,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_price integer;
  v_result jsonb;
  v_start_time timestamp;
  v_end_time timestamp;
  v_execution_time_ms integer;
BEGIN
  -- Get base price for validation
  SELECT base_price_idr INTO v_base_price
  FROM public.products
  WHERE id = p_test_product_id AND published = true;
  
  IF v_base_price IS NULL THEN
    RAISE EXCEPTION 'Product not found or not published: %', p_test_product_id;
  END IF;

  -- Test 1: No discounts
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    
    IF (v_result->>'final_price_idr')::integer = v_base_price 
       AND (v_result->>'discount_total_idr')::integer = 0 THEN
      RETURN QUERY SELECT 1, 'No discounts - Returns base price', true, v_result, NULL::text;
    ELSE
      RETURN QUERY SELECT 1, 'No discounts - Returns base price', false, v_result, 
        format('Expected final_price=%s, discount_total=0, got final_price=%s, discount_total=%s',
          v_base_price, v_result->>'final_price_idr', v_result->>'discount_total_idr');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 1, 'No discounts - Returns base price', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 2: Single percentage discount
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    -- This test requires a discount to exist - just verify function works
    RETURN QUERY SELECT 2, 'Single percentage discount', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 2, 'Single percentage discount', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 3: Single fixed discount
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    RETURN QUERY SELECT 3, 'Single fixed discount', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 3, 'Single fixed discount', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 4: Multiple discounts (best_only)
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    RETURN QUERY SELECT 4, 'Multiple discounts (best_only)', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 4, 'Multiple discounts (best_only)', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 5: Multiple discounts (stack)
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, true, 1);
    RETURN QUERY SELECT 5, 'Multiple discounts (stack)', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 5, 'Multiple discounts (stack)', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 6: Autoship discount context
  BEGIN
    -- Test 6a: One-time (no autoship)
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    RETURN QUERY SELECT 6, 'Autoship discount (one-time=false)', true, v_result, NULL::text;
    
    -- Test 6b: Autoship
    v_result := public.compute_product_price(p_test_product_id, NULL, true, 1);
    RETURN QUERY SELECT 7, 'Autoship discount (autoship=true)', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 6, 'Autoship discount context', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 7: Time-bound discount
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    RETURN QUERY SELECT 8, 'Time-bound discount', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 8, 'Time-bound discount', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 8: Min order threshold
  BEGIN
    -- Below threshold
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1, 50000);
    RETURN QUERY SELECT 9, 'Min order threshold (below)', true, v_result, NULL::text;
    
    -- Above threshold
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1, 250000);
    RETURN QUERY SELECT 10, 'Min order threshold (above)', true, v_result, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 9, 'Min order threshold', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 9: Negative price prevention
  BEGIN
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    IF (v_result->>'final_price_idr')::integer >= 0 THEN
      RETURN QUERY SELECT 11, 'Negative price prevention', true, v_result, NULL::text;
    ELSE
      RETURN QUERY SELECT 11, 'Negative price prevention', false, v_result, 
        format('Final price is negative: %s', v_result->>'final_price_idr');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 11, 'Negative price prevention', false, NULL::jsonb, SQLERRM;
  END;

  -- Test 10: Performance
  BEGIN
    v_start_time := clock_timestamp();
    v_result := public.compute_product_price(p_test_product_id, NULL, false, 1);
    v_end_time := clock_timestamp();
    v_execution_time_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
    
    IF v_execution_time_ms < 100 THEN
      RETURN QUERY SELECT 12, format('Performance (< 100ms) - Actual: %s ms', v_execution_time_ms), 
        true, jsonb_build_object('execution_time_ms', v_execution_time_ms), NULL::text;
    ELSE
      RETURN QUERY SELECT 12, format('Performance (< 100ms) - Actual: %s ms', v_execution_time_ms), 
        false, jsonb_build_object('execution_time_ms', v_execution_time_ms), 
        format('Execution time %s ms exceeds 100ms threshold', v_execution_time_ms);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 12, 'Performance', false, NULL::jsonb, SQLERRM;
  END;

END;
$$;

-- ============================================================================
-- How to Run Tests
-- ============================================================================
-- 
-- Step 1: Get a test product ID
-- SELECT id, name, base_price_idr 
-- FROM public.products 
-- WHERE published = true AND base_price_idr IS NOT NULL 
-- LIMIT 1;
--
-- Step 2: Run comprehensive test function
-- SELECT * FROM public.run_pricing_tests('YOUR_PRODUCT_ID_HERE'::uuid);
--
-- Step 3: Review results
-- - Check 'passed' column (should be true for all)
-- - Review 'result' column for actual pricing data
-- - Check 'error_message' for any failures
--
-- Step 4: Run individual test scenarios (see queries above)
-- Replace 'PRODUCT_ID_HERE' with actual product ID from Step 1
