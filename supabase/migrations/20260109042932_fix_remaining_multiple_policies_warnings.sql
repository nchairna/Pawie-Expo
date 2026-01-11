-- Migration: Fix Remaining Multiple Permissive Policies Warnings
-- Purpose: Replace FOR ALL policies with separate INSERT/UPDATE/DELETE policies
-- Date: 2026-01-09
-- 
-- Issue: Policies using FOR ALL include SELECT, causing overlap with SELECT policies
-- Fix: Replace FOR ALL with separate policies for INSERT, UPDATE, DELETE only
--
-- Affected tables:
-- - product_families
-- - variant_dimensions
-- - variant_values
-- - product_variant_values
-- - product_tags
-- - product_tag_assignments

-- ============================================================================
-- Fix 1: Product Families Table
-- ============================================================================

-- Drop the FOR ALL policy
DROP POLICY IF EXISTS "product_families_admin_modify" ON public.product_families;

-- Create separate policies for INSERT, UPDATE, DELETE (not SELECT)
CREATE POLICY "product_families_admin_insert" ON public.product_families
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "product_families_admin_update" ON public.product_families
    FOR UPDATE
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

CREATE POLICY "product_families_admin_delete" ON public.product_families
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- Fix 2: Variant Dimensions Table
-- ============================================================================

DROP POLICY IF EXISTS "variant_dimensions_admin_modify" ON public.variant_dimensions;

CREATE POLICY "variant_dimensions_admin_insert" ON public.variant_dimensions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "variant_dimensions_admin_update" ON public.variant_dimensions
    FOR UPDATE
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

CREATE POLICY "variant_dimensions_admin_delete" ON public.variant_dimensions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- Fix 3: Variant Values Table
-- ============================================================================

DROP POLICY IF EXISTS "variant_values_admin_modify" ON public.variant_values;

CREATE POLICY "variant_values_admin_insert" ON public.variant_values
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "variant_values_admin_update" ON public.variant_values
    FOR UPDATE
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

CREATE POLICY "variant_values_admin_delete" ON public.variant_values
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- Fix 4: Product Variant Values Table
-- ============================================================================

DROP POLICY IF EXISTS "product_variant_values_admin_modify" ON public.product_variant_values;

CREATE POLICY "product_variant_values_admin_insert" ON public.product_variant_values
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "product_variant_values_admin_update" ON public.product_variant_values
    FOR UPDATE
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

CREATE POLICY "product_variant_values_admin_delete" ON public.product_variant_values
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- Fix 5: Product Tags Table
-- ============================================================================

DROP POLICY IF EXISTS "product_tags_admin_modify" ON public.product_tags;

CREATE POLICY "product_tags_admin_insert" ON public.product_tags
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "product_tags_admin_update" ON public.product_tags
    FOR UPDATE
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

CREATE POLICY "product_tags_admin_delete" ON public.product_tags
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- Fix 6: Product Tag Assignments Table
-- ============================================================================

DROP POLICY IF EXISTS "product_tag_assignments_admin_modify" ON public.product_tag_assignments;

CREATE POLICY "product_tag_assignments_admin_insert" ON public.product_tag_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (select auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

CREATE POLICY "product_tag_assignments_admin_update" ON public.product_tag_assignments
    FOR UPDATE
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

CREATE POLICY "product_tag_assignments_admin_delete" ON public.product_tag_assignments
    FOR DELETE
    TO authenticated
    USING (
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
-- This migration fixes 6 remaining multiple_permissive_policies warnings by:
-- - Replacing FOR ALL policies with separate INSERT, UPDATE, DELETE policies
-- - This eliminates overlap with SELECT policies
-- - Admins now use _select policy for reads, and separate policies for writes
--
-- After this migration, all multiple_permissive_policies warnings should be resolved.
