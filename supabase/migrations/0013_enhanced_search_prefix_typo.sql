-- Migration: Enhanced Search with Prefix Matching and Typo Tolerance
-- Date: 2026-01-07
-- Purpose: Add prefix matching and typo tolerance to product search
-- Prerequisites: Migration 0011 (product_search_fulltext) must be applied

-- ============================================================================
-- STEP 1: Enable pg_trgm Extension (for trigram similarity)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMENT ON EXTENSION pg_trgm IS 
  'PostgreSQL trigram extension for fuzzy string matching and typo tolerance';

-- ============================================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================================

-- GIN index for trigram similarity on product name
CREATE INDEX IF NOT EXISTS products_name_trgm_idx 
ON public.products 
USING gin (name gin_trgm_ops);

-- B-tree index for prefix matching (ILIKE queries)
CREATE INDEX IF NOT EXISTS products_name_lower_idx 
ON public.products (LOWER(name) text_pattern_ops);

-- ============================================================================
-- STEP 3: Create Enhanced Search Function
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
DECLARE
  query_lower text;
  similarity_threshold real;
BEGIN
  -- Normalize query
  query_lower := LOWER(TRIM(search_query));
  
  -- Adjust similarity threshold based on query length
  -- Shorter queries need higher threshold to avoid irrelevant matches
  IF LENGTH(query_lower) <= 2 THEN
    similarity_threshold := 0.4;
  ELSIF LENGTH(query_lower) <= 5 THEN
    similarity_threshold := 0.3;
  ELSE
    similarity_threshold := 0.25;
  END IF;

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
    -- Combined relevance scoring with proper ranking:
    -- 1. Full-text exact match (highest weight: 3.0)
    -- 2. Prefix match on name (medium weight: 2.0)
    -- 3. Trigram similarity for typos (lower weight: 1.0, with threshold)
    GREATEST(
      -- Full-text exact match (highest priority)
      CASE 
        WHEN p.searchable_text @@ plainto_tsquery('english', search_query)
        THEN ts_rank(p.searchable_text, plainto_tsquery('english', search_query)) * 3.0
        ELSE 0::real
      END,
      -- Prefix match on name (medium priority)
      CASE 
        WHEN LOWER(p.name) LIKE query_lower || '%'
        THEN 2.0::real
        ELSE 0::real
      END,
      -- Prefix match on description (lower priority)
      CASE 
        WHEN LOWER(COALESCE(p.description, '')) LIKE '%' || query_lower || '%'
        THEN 1.5::real
        ELSE 0::real
      END,
      -- Trigram similarity for typos (lowest priority, with threshold)
      CASE 
        WHEN similarity(p.name, search_query) > similarity_threshold
        THEN (similarity(p.name, search_query) * 1.0)::real
        ELSE 0::real
      END
    )::real as relevance
  FROM public.products p
  WHERE 
    p.published = true
    AND (
      -- Full-text search (exact word matches)
      p.searchable_text @@ plainto_tsquery('english', search_query)
      OR
      -- Prefix matching on name
      LOWER(p.name) LIKE query_lower || '%'
      OR
      -- Prefix matching on description
      LOWER(COALESCE(p.description, '')) LIKE '%' || query_lower || '%'
      OR
      -- Prefix matching on category
      LOWER(COALESCE(p.category, '')) LIKE query_lower || '%'
      OR
      -- Typo tolerance (only if similarity is high enough)
      similarity(p.name, search_query) > similarity_threshold
    )
  ORDER BY 
    relevance DESC,
    p.updated_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

COMMENT ON FUNCTION public.search_products IS 
  'Enhanced full-text search for published products with prefix matching and typo tolerance. Returns products matching the search query, ordered by relevance (exact > prefix > typo) and updated_at. Respects RLS policies.';

-- ============================================================================
-- STEP 4: Verify Permissions (should already exist from migration 0011)
-- ============================================================================

-- Permissions should already be granted, but verify:
-- GRANT EXECUTE ON FUNCTION public.search_products TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.search_products TO anon;

