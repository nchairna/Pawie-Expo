-- Migration: 0015_pricing_functions.sql
-- Purpose: Core pricing computation functions for Phase 3
-- Date: 2026-01-08

-- ============================================================================
-- Function: find_applicable_discounts
-- Purpose: Find all discounts that apply to a given product in a context
-- ============================================================================

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
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS discount_id,
    d.name,
    d.kind,
    d.discount_type,
    d.value,
    d.stack_policy
  FROM public.discounts d
  LEFT JOIN public.discount_targets dt ON dt.discount_id = d.id
  WHERE 
    -- Must be active
    d.active = true
    -- Time window check
    AND (d.starts_at IS NULL OR d.starts_at <= NOW())
    AND (d.ends_at IS NULL OR d.ends_at >= NOW())
    -- Product targeting: either targets this product OR applies to all products
    AND (
      dt.product_id = p_product_id 
      OR dt.applies_to_all_products = true
    )
    -- Autoship context: only include autoship discounts if p_is_autoship = true
    AND (
      d.kind = 'promo' 
      OR (d.kind = 'autoship' AND p_is_autoship = true)
    )
    -- Min order threshold check
    AND (
      d.min_order_subtotal_idr IS NULL 
      OR p_cart_total_idr IS NULL 
      OR p_cart_total_idr >= d.min_order_subtotal_idr
    )
    -- Usage limit check (if set)
    AND (
      d.usage_limit IS NULL 
      OR d.usage_count < d.usage_limit
    )
  ORDER BY 
    -- For best_only policy, order by discount amount (descending)
    CASE 
      WHEN d.discount_type = 'percentage' THEN d.value
      WHEN d.discount_type = 'fixed' THEN 999999  -- Fixed discounts sorted last for best_only
      ELSE 0
    END DESC;
END;
$$;

-- ============================================================================
-- Function: apply_discount_stacking
-- Purpose: Apply stacking policy to a set of discounts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_discount_stacking(
  p_base_price_idr integer,
  p_discounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_final_price integer := p_base_price_idr;
  v_discount_total integer := 0;
  v_discounts_applied jsonb := '[]'::jsonb;
  v_discount jsonb;
  v_discount_amount integer;
  v_has_best_only boolean := false;
  v_best_discount jsonb;
  v_best_amount integer := 0;
BEGIN
  -- If no discounts, return base price
  IF p_discounts IS NULL OR jsonb_array_length(p_discounts) = 0 THEN
    RETURN jsonb_build_object(
      'final_price_idr', p_base_price_idr,
      'discount_total_idr', 0,
      'discounts_applied', '[]'::jsonb
    );
  END IF;

  -- Check if any discount has best_only policy
  FOR v_discount IN SELECT * FROM jsonb_array_elements(p_discounts)
  LOOP
    IF (v_discount->>'stack_policy') = 'best_only' THEN
      v_has_best_only := true;
      EXIT;
    END IF;
  END LOOP;

  -- If best_only policy exists, take highest discount only
  IF v_has_best_only THEN
    FOR v_discount IN SELECT * FROM jsonb_array_elements(p_discounts)
    LOOP
      -- Calculate discount amount
      IF (v_discount->>'discount_type') = 'percentage' THEN
        v_discount_amount := (p_base_price_idr * (v_discount->>'value')::integer) / 100;
      ELSIF (v_discount->>'discount_type') = 'fixed' THEN
        v_discount_amount := (v_discount->>'value')::integer;
      ELSE
        v_discount_amount := 0;
      END IF;

      -- Track best discount
      IF v_discount_amount > v_best_amount THEN
        v_best_amount := v_discount_amount;
        v_best_discount := v_discount;
      END IF;
    END LOOP;

    -- Apply best discount
    IF v_best_discount IS NOT NULL THEN
      v_discount_total := v_best_amount;
      v_final_price := GREATEST(0, p_base_price_idr - v_discount_total);
      v_discounts_applied := jsonb_build_array(jsonb_build_object(
        'discount_id', v_best_discount->>'discount_id',
        'name', v_best_discount->>'name',
        'type', v_best_discount->>'discount_type',
        'value', v_best_discount->>'value',
        'amount', v_best_amount
      ));
    END IF;
  ELSE
    -- Stack policy: apply percentage discounts first, then fixed
    -- Step 1: Apply percentage discounts (multiplicative)
    FOR v_discount IN SELECT * FROM jsonb_array_elements(p_discounts)
    LOOP
      IF (v_discount->>'discount_type') = 'percentage' THEN
        v_discount_amount := (v_final_price * (v_discount->>'value')::integer) / 100;
        v_discount_total := v_discount_total + v_discount_amount;
        v_final_price := GREATEST(0, v_final_price - v_discount_amount);
        v_discounts_applied := v_discounts_applied || jsonb_build_object(
          'discount_id', v_discount->>'discount_id',
          'name', v_discount->>'name',
          'type', v_discount->>'discount_type',
          'value', v_discount->>'value',
          'amount', v_discount_amount
        );
      END IF;
    END LOOP;

    -- Step 2: Apply fixed discounts (additive)
    FOR v_discount IN SELECT * FROM jsonb_array_elements(p_discounts)
    LOOP
      IF (v_discount->>'discount_type') = 'fixed' THEN
        v_discount_amount := (v_discount->>'value')::integer;
        v_discount_total := v_discount_total + v_discount_amount;
        v_final_price := GREATEST(0, v_final_price - v_discount_amount);
        v_discounts_applied := v_discounts_applied || jsonb_build_object(
          'discount_id', v_discount->>'discount_id',
          'name', v_discount->>'name',
          'type', v_discount->>'discount_type',
          'value', v_discount->>'value',
          'amount', v_discount_amount
        );
      END IF;
    END LOOP;
  END IF;

  -- Ensure final price never goes negative
  v_final_price := GREATEST(0, v_final_price);

  RETURN jsonb_build_object(
    'final_price_idr', v_final_price,
    'discount_total_idr', v_discount_total,
    'discounts_applied', v_discounts_applied
  );
END;
$$;

-- ============================================================================
-- Function: compute_product_price
-- Purpose: Main pricing computation function
-- Returns: JSONB with base price, final price, discounts, and line total
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_product_price(
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
STABLE
AS $$
DECLARE
  v_base_price_idr integer;
  v_product_published boolean;
  v_discounts jsonb;
  v_stacking_result jsonb;
  v_final_price_idr integer;
  v_discount_total_idr integer;
  v_discounts_applied jsonb;
  v_line_total_idr integer;
BEGIN
  -- Validate product exists and is published
  SELECT base_price_idr, published
  INTO v_base_price_idr, v_product_published
  FROM public.products
  WHERE id = p_product_id;

  IF v_base_price_idr IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF NOT v_product_published THEN
    RAISE EXCEPTION 'Product is not published: %', p_product_id;
  END IF;

  -- Find applicable discounts
  SELECT jsonb_agg(
    jsonb_build_object(
      'discount_id', discount_id,
      'name', name,
      'kind', kind,
      'discount_type', discount_type,
      'value', value,
      'stack_policy', stack_policy
    )
  )
  INTO v_discounts
  FROM public.find_applicable_discounts(
    p_product_id,
    p_is_autoship,
    p_cart_total_idr
  );

  -- If no discounts, return base price
  IF v_discounts IS NULL THEN
    v_final_price_idr := v_base_price_idr;
    v_discount_total_idr := 0;
    v_discounts_applied := '[]'::jsonb;
  ELSE
    -- Apply stacking policy
    v_stacking_result := public.apply_discount_stacking(v_base_price_idr, v_discounts);
    v_final_price_idr := (v_stacking_result->>'final_price_idr')::integer;
    v_discount_total_idr := (v_stacking_result->>'discount_total_idr')::integer;
    v_discounts_applied := v_stacking_result->'discounts_applied';
  END IF;

  -- Calculate line total
  v_line_total_idr := v_final_price_idr * p_quantity;

  -- Return complete breakdown
  RETURN jsonb_build_object(
    'base_price_idr', v_base_price_idr,
    'final_price_idr', v_final_price_idr,
    'discount_total_idr', v_discount_total_idr,
    'discounts_applied', v_discounts_applied,
    'line_total_idr', v_line_total_idr
  );
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION find_applicable_discounts IS 
'Finds all discounts applicable to a product based on context (autoship, cart total, time windows)';

COMMENT ON FUNCTION apply_discount_stacking IS 
'Applies stacking policy (best_only or stack) to a set of discounts and returns final price breakdown';

COMMENT ON FUNCTION compute_product_price IS 
'Main pricing function: computes final price for a product with all applicable discounts applied. Returns JSONB with base price, final price, discount breakdown, and line total.';

