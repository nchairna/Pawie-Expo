-- Migration: Add low_stock_threshold column to inventory
-- Description: Adds threshold column for low stock alerts
-- Date: 2026-01-18

-- Add low_stock_threshold column with default value of 10
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 10;

-- Add comment
COMMENT ON COLUMN public.inventory.low_stock_threshold IS 'Threshold below which product is considered low stock';
