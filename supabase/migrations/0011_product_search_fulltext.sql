-- Migration: Product Full-Text Search
-- Date: 2026-01-07
-- Purpose: Enable Postgres full-text search for products

-- ============================================================================
-- STEP 1: Add Generated Column for Searchable Text
-- ============================================================================

-- Create a generated column that combines name, description, and category
-- This will be automatically updated when those columns change
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS searchable_text tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'C')
) STORED;

COMMENT ON COLUMN public.products.searchable_text IS 
  'Generated tsvector for full-text search. Name has weight A (highest), description has weight B, category has weight C.';

-- ============================================================================
-- STEP 2: Create GIN Index for Fast Full-Text Search
-- ============================================================================

CREATE INDEX IF NOT EXISTS products_searchable_text_idx 
ON public.products 
USING GIN (searchable_text);

-- Also create index on published flag for faster filtering
CREATE INDEX IF NOT EXISTS products_published_idx 
ON public.products (published) 
WHERE published = true;

-- ============================================================================
-- STEP 3: Create Search Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_products(
  search_query text,
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
  updated_at timestamptz,
  relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    p.updated_at,
    ts_rank(p.searchable_text, plainto_tsquery('english', search_query)) as relevance
  FROM public.products p
  WHERE 
    p.published = true
    AND p.searchable_text @@ plainto_tsquery('english', search_query)
  ORDER BY 
    relevance DESC,
    p.updated_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

COMMENT ON FUNCTION public.search_products IS 
  'Full-text search for published products. Returns products matching the search query, ordered by relevance and updated_at. Respects RLS policies.';

-- ============================================================================
-- STEP 4: Grant Execute Permission
-- ============================================================================

-- Allow authenticated and anon users to execute search function
GRANT EXECUTE ON FUNCTION public.search_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products TO anon;

-- ============================================================================
-- STEP 5: Verify RLS Policies
-- ============================================================================

-- Ensure RLS policies allow reading published products
-- This should already exist from Phase 2, but verify:
-- SELECT * FROM pg_policies WHERE tablename = 'products' AND policyname LIKE '%read%';

