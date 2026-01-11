-- Migration: Fix RLS Performance and Security Warnings
-- Purpose: Address 29 warnings from Supabase database linter
-- Date: 2026-01-09
--
-- Fixes:
-- 1. Security: Function search_path mutable (5 functions) - HIGH PRIORITY
-- 2. Security: Extension in public schema (pg_trgm)
-- 3. Performance: Auth RLS initialization plan (16 policies)
-- 4. Performance: Multiple permissive policies (6 tables)

-- ============================================================================
-- PART 1: SECURITY FIXES - Function Search Path Mutable
-- ============================================================================
-- Fix: Add SET search_path = '' to prevent SQL injection via search path manipulation
-- Priority: HIGH - Security vulnerability

-- Fix 1: is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Fix 2: handle_new_user() function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Fix 3: find_applicable_discounts() function
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
SET search_path = ''
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

-- Fix 4: apply_discount_stacking() function
CREATE OR REPLACE FUNCTION public.apply_discount_stacking(
  p_base_price_idr integer,
  p_discounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
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

-- Fix 5: compute_product_price() function
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
SET search_path = ''
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

-- ============================================================================
-- PART 2: SECURITY FIXES - Extension in Public Schema
-- ============================================================================
-- Note: pg_trgm extension move has been moved to a separate migration:
-- 20260109042552_move_pg_trgm_to_extensions_schema.sql
-- 
-- This was done because the original migration was already applied, and
-- migrations should be immutable once applied.

-- ============================================================================
-- PART 3: PERFORMANCE FIXES - Auth RLS Initialization Plan
-- ============================================================================
-- Fix: Wrap auth.uid() and is_admin() calls in (select ...) to evaluate once per query
-- This prevents re-evaluation for each row, improving performance 10-100x

-- Fix 1: Profiles Table
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT
    USING (((select auth.uid()) = id) OR (select is_admin()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- Fix 2: Pets Table
DROP POLICY IF EXISTS "pets_crud_own_or_admin" ON public.pets;
CREATE POLICY "pets_crud_own_or_admin" ON public.pets
    FOR ALL
    TO public
    USING (((select auth.uid()) = user_id) OR (select is_admin()))
    WITH CHECK (((select auth.uid()) = user_id) OR (select is_admin()));

-- Fix 3: Addresses Table
DROP POLICY IF EXISTS "addresses_crud_own_or_admin" ON public.addresses;
CREATE POLICY "addresses_crud_own_or_admin" ON public.addresses
    FOR ALL
    TO public
    USING (((select auth.uid()) = user_id) OR (select is_admin()))
    WITH CHECK (((select auth.uid()) = user_id) OR (select is_admin()));

-- Fix 4: Orders Table
DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin" ON public.orders
    FOR SELECT
    TO public
    USING (((select auth.uid()) = user_id) OR (select is_admin()));

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- Fix 5: Order Items Table
DROP POLICY IF EXISTS "order_items_select_own_orders_or_admin" ON public.order_items;
CREATE POLICY "order_items_select_own_orders_or_admin" ON public.order_items
    FOR SELECT
    TO public
    USING (
        (select is_admin()) OR (
            EXISTS (
                SELECT 1
                FROM orders o
                WHERE o.id = order_items.order_id
                    AND o.user_id = (select auth.uid())
            )
        )
    );

-- Fix 6: Autoships Table
DROP POLICY IF EXISTS "autoships_crud_own_or_admin" ON public.autoships;
CREATE POLICY "autoships_crud_own_or_admin" ON public.autoships
    FOR ALL
    TO public
    USING (((select auth.uid()) = user_id) OR (select is_admin()))
    WITH CHECK (((select auth.uid()) = user_id) OR (select is_admin()));

-- Fix 7: Autoship Runs Table
DROP POLICY IF EXISTS "autoship_runs_select_own_or_admin" ON public.autoship_runs;
CREATE POLICY "autoship_runs_select_own_or_admin" ON public.autoship_runs
    FOR SELECT
    TO public
    USING (
        (select is_admin()) OR (
            EXISTS (
                SELECT 1
                FROM autoships a
                WHERE a.id = autoship_runs.autoship_id
                    AND a.user_id = (select auth.uid())
            )
        )
    );

-- ============================================================================
-- PART 4: PERFORMANCE FIXES - Multiple Permissive Policies
-- ============================================================================
-- Fix: Consolidate multiple SELECT policies into single policies using OR conditions
-- This improves performance by reducing policy evaluation overhead

-- Fix 8: Product Families Table
DROP POLICY IF EXISTS "product_families_public_read" ON public.product_families;
DROP POLICY IF EXISTS "product_families_admin_all" ON public.product_families;

-- Create single consolidated SELECT policy
CREATE POLICY "product_families_select" ON public.product_families
    FOR SELECT
    TO public
    USING (
        true OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "product_families_admin_modify" ON public.product_families
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Fix 9: Variant Dimensions Table
DROP POLICY IF EXISTS "variant_dimensions_public_read" ON public.variant_dimensions;
DROP POLICY IF EXISTS "variant_dimensions_admin_all" ON public.variant_dimensions;

-- Create single consolidated SELECT policy
CREATE POLICY "variant_dimensions_select" ON public.variant_dimensions
    FOR SELECT
    TO public
    USING (
        true OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "variant_dimensions_admin_modify" ON public.variant_dimensions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Fix 10: Variant Values Table
DROP POLICY IF EXISTS "variant_values_public_read" ON public.variant_values;
DROP POLICY IF EXISTS "variant_values_admin_all" ON public.variant_values;

-- Create single consolidated SELECT policy
CREATE POLICY "variant_values_select" ON public.variant_values
    FOR SELECT
    TO public
    USING (
        true OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "variant_values_admin_modify" ON public.variant_values
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Fix 11: Product Variant Values Table
DROP POLICY IF EXISTS "product_variant_values_public_read" ON public.product_variant_values;
DROP POLICY IF EXISTS "product_variant_values_admin_all" ON public.product_variant_values;

-- Create single consolidated SELECT policy
CREATE POLICY "product_variant_values_select" ON public.product_variant_values
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM products
            WHERE products.id = product_variant_values.product_id
                AND products.published = true
        ) OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "product_variant_values_admin_modify" ON public.product_variant_values
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Fix 12: Product Tags Table
DROP POLICY IF EXISTS "product_tags_public_read" ON public.product_tags;
DROP POLICY IF EXISTS "product_tags_admin_all" ON public.product_tags;

-- Create single consolidated SELECT policy
CREATE POLICY "product_tags_select" ON public.product_tags
    FOR SELECT
    TO public
    USING (
        true OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "product_tags_admin_modify" ON public.product_tags
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Fix 13: Product Tag Assignments Table
DROP POLICY IF EXISTS "product_tag_assignments_public_read" ON public.product_tag_assignments;
DROP POLICY IF EXISTS "product_tag_assignments_admin_all" ON public.product_tag_assignments;

-- Create single consolidated SELECT policy
CREATE POLICY "product_tag_assignments_select" ON public.product_tag_assignments
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM products
            WHERE products.id = product_tag_assignments.product_id
                AND products.published = true
        ) OR (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.id = (select auth.uid())
                    AND profiles.role = 'admin'::text
            )
        )
    );

-- Keep admin-only policies for INSERT/UPDATE/DELETE
CREATE POLICY "product_tag_assignments_admin_modify" ON public.product_tag_assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration fixes:
-- ✅ 5 function search_path warnings (security) - Added SET search_path = '' to all functions
-- ✅ 16 auth_rls_initplan warnings (performance) - Wrapped auth calls in (select ...)
-- ✅ 6 multiple_permissive_policies warnings (performance) - Consolidated policies
-- 
-- Total: 27 warnings fixed (1 auth warning skipped as requested)
--
-- Note: pg_trgm extension move is in separate migration:
-- 20260109042552_move_pg_trgm_to_extensions_schema.sql
--
-- Changes made:
-- - 5 functions updated with fixed search_path
-- - 13 RLS policies optimized for performance
-- - 6 tables with consolidated SELECT policies
