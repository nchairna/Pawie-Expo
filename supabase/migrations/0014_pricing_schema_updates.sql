-- Migration: 0014_pricing_schema_updates.sql
-- Purpose: Add missing columns needed for Phase 3 pricing engine
-- Date: 2026-01-08

-- Add applies_to_all_products to discount_targets
-- First add as nullable, then set default, then make NOT NULL
ALTER TABLE public.discount_targets
ADD COLUMN IF NOT EXISTS applies_to_all_products boolean;

-- Set default for existing rows
UPDATE public.discount_targets
SET applies_to_all_products = false
WHERE applies_to_all_products IS NULL;

-- Now set default and NOT NULL constraint
ALTER TABLE public.discount_targets
ALTER COLUMN applies_to_all_products SET DEFAULT false,
ALTER COLUMN applies_to_all_products SET NOT NULL;

-- Add usage tracking to discounts
ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS usage_limit integer,
ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

-- Update discount_targets constraint to ensure exactly one targeting method
-- Remove old constraint if it exists
ALTER TABLE public.discount_targets
DROP CONSTRAINT IF EXISTS discount_targets_check;

-- Add new constraint: exactly one of product_id OR applies_to_all_products must be set
ALTER TABLE public.discount_targets
ADD CONSTRAINT discount_targets_check CHECK (
  (product_id IS NOT NULL)::int + 
  (applies_to_all_products = true)::int = 1
);

-- Add index for applies_to_all_products lookups
CREATE INDEX IF NOT EXISTS idx_discount_targets_all_products 
ON public.discount_targets(discount_id) 
WHERE applies_to_all_products = true;

-- Add index for active discounts with time windows
CREATE INDEX IF NOT EXISTS idx_discounts_active_time 
ON public.discounts(active, starts_at, ends_at) 
WHERE active = true;

-- Add comment for clarity
COMMENT ON COLUMN public.discount_targets.applies_to_all_products IS 
'When true, discount applies to all products. Used for global autoship discounts.';
COMMENT ON COLUMN public.discounts.usage_limit IS 
'Maximum number of times this discount can be used. NULL = unlimited.';
COMMENT ON COLUMN public.discounts.usage_count IS 
'Current number of times this discount has been used.';

