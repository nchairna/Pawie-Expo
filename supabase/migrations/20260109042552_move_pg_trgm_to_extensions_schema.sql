-- Migration: Move pg_trgm Extension to Extensions Schema
-- Purpose: Fix "extension_in_public" security warning by moving pg_trgm to dedicated schema
-- Date: 2026-01-09
-- Prerequisites: Migration 0013 (enhanced_search_prefix_typo) must be applied

-- ============================================================================
-- Move pg_trgm Extension from public to extensions Schema
-- ============================================================================
-- This migration moves the pg_trgm extension to a dedicated extensions schema
-- following security best practices. The extension is used for fuzzy text
-- matching and typo tolerance in product search.

-- Step 1: Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Step 2: Drop the GIN index that depends on pg_trgm
-- This index uses gin_trgm_ops operator class from pg_trgm
-- The index will be recreated after moving the extension
DROP INDEX IF EXISTS public.products_name_trgm_idx;

-- Step 3: Drop extension from public schema
-- This will also drop all functions, operators, and operator classes from pg_trgm
-- Note: This is safe because we'll recreate it immediately in the extensions schema
DROP EXTENSION IF EXISTS pg_trgm;

-- Step 4: Create extension in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Step 5: Recreate the GIN index
-- The gin_trgm_ops operator class is now in extensions schema
-- PostgreSQL will find it automatically through search_path
CREATE INDEX IF NOT EXISTS products_name_trgm_idx 
ON public.products 
USING gin (name gin_trgm_ops);

-- Step 6: Grant usage on extensions schema so similarity() and other functions are accessible
-- This allows public and authenticated roles to use pg_trgm functions
GRANT USAGE ON SCHEMA extensions TO public;
GRANT USAGE ON SCHEMA extensions TO authenticated;

-- Step 7: Update search_products function to include extensions in search_path
-- The function uses similarity() from pg_trgm, which is now in extensions schema
-- We need to update the search_path so the function can find similarity()
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
SET search_path = public, extensions
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

-- ============================================================================
-- Verification
-- ============================================================================
-- After applying this migration, verify:
-- 1. Extension is in extensions schema:
--    SELECT extname, n.nspname FROM pg_extension e 
--    JOIN pg_namespace n ON e.extnamespace = n.oid WHERE extname = 'pg_trgm';
--
-- 2. Index exists and works:
--    SELECT * FROM products WHERE name % 'royal' LIMIT 5;
--
-- 3. Search function works:
--    SELECT * FROM search_products('royal canin', 10);

COMMENT ON SCHEMA extensions IS 
  'Dedicated schema for PostgreSQL extensions following security best practices';
