-- Migration: Product Tag Filter Function
-- Date: 2026-01-07
-- Purpose: Enable filtering products by tags

-- ============================================================================
-- STEP 1: Create Tag Filter Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_products_by_tags(
  tag_ids uuid[],
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  published boolean,
  autoship_eligible boolean,
  primary_image_path text,
  base_price_idr integer,
  sku text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no tags provided, return all published products
  IF array_length(tag_ids, 1) IS NULL OR array_length(tag_ids, 1) = 0 THEN
    RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.description,
      p.category,
      p.published,
      p.autoship_eligible,
      p.primary_image_path,
      p.base_price_idr,
      p.sku,
      p.created_at,
      p.updated_at
    FROM public.products p
    WHERE p.published = true
    ORDER BY p.updated_at DESC
    LIMIT result_limit
    OFFSET result_offset;
  ELSE
    -- Filter products that have ALL specified tags (AND logic)
    RETURN QUERY
    SELECT DISTINCT
      p.id,
      p.name,
      p.description,
      p.category,
      p.published,
      p.autoship_eligible,
      p.primary_image_path,
      p.base_price_idr,
      p.sku,
      p.created_at,
      p.updated_at
    FROM public.products p
    INNER JOIN public.product_tag_assignments pta ON p.id = pta.product_id
    WHERE 
      p.published = true
      AND pta.tag_id = ANY(tag_ids)
    GROUP BY p.id, p.name, p.description, p.category, p.published, 
             p.autoship_eligible, p.primary_image_path, p.base_price_idr, 
             p.sku, p.created_at, p.updated_at
    HAVING COUNT(DISTINCT pta.tag_id) = array_length(tag_ids, 1)
    ORDER BY p.updated_at DESC
    LIMIT result_limit
    OFFSET result_offset;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.filter_products_by_tags IS 
  'Filter published products by tags. Products must have ALL specified tags (AND logic). Returns products ordered by updated_at. Respects RLS policies.';

-- ============================================================================
-- STEP 2: Grant Execute Permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.filter_products_by_tags TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_products_by_tags TO anon;

-- ============================================================================
-- STEP 3: Create Index for Performance (if not exists)
-- ============================================================================

-- These indexes should already exist from Phase 2, but verify:
-- CREATE INDEX IF NOT EXISTS product_tag_assignments_product_id_idx 
--   ON public.product_tag_assignments(product_id);
-- CREATE INDEX IF NOT EXISTS product_tag_assignments_tag_id_idx 
--   ON public.product_tag_assignments(tag_id);

