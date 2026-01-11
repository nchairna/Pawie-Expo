-- Migration: Deprecate products.category Field
-- Date: 2026-01-03
-- Purpose: Migrate from category field to product_tags system

-- ============================================================================
-- STEP 1: Add Deprecation Comment
-- ============================================================================

COMMENT ON COLUMN public.products.category IS 
    'DEPRECATED: Use product_tags instead. Kept for backward compatibility only. This field will be removed in Phase 4+.';

-- ============================================================================
-- STEP 2: Migrate Existing Categories to Tags
-- ============================================================================

-- Create tags from existing categories (if they don't already exist)
INSERT INTO public.product_tags (name, slug)
SELECT DISTINCT 
    category as name,
    LOWER(REPLACE(REPLACE(REPLACE(category, ' ', '-'), '_', '-'), '--', '-')) as slug
FROM public.products
WHERE category IS NOT NULL
    AND category != ''
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Assign Tags to Products Based on Category
-- ============================================================================

-- Link products to tags based on their category
INSERT INTO public.product_tag_assignments (product_id, tag_id)
SELECT 
    p.id as product_id,
    pt.id as tag_id
FROM public.products p
JOIN public.product_tags pt ON LOWER(REPLACE(REPLACE(REPLACE(p.category, ' ', '-'), '_', '-'), '--', '-')) = pt.slug
WHERE p.category IS NOT NULL
    AND p.category != ''
ON CONFLICT (product_id, tag_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Add Migration Timestamp
-- ============================================================================

-- Add column to track when category was migrated (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'category_migrated_at'
    ) THEN
        ALTER TABLE public.products 
        ADD COLUMN category_migrated_at timestamptz;
    END IF;
END $$;

-- Mark products that had categories as migrated
UPDATE public.products
SET category_migrated_at = NOW()
WHERE category IS NOT NULL
    AND category != ''
    AND category_migrated_at IS NULL;

-- ============================================================================
-- NOTES
-- ============================================================================

-- The category column remains in the table for backward compatibility
-- It is already nullable, so no ALTER needed
-- Future: In Phase 4+, drop products.category column entirely:
--   ALTER TABLE public.products DROP COLUMN category;
--   ALTER TABLE public.products DROP COLUMN category_migrated_at;


