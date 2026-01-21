-- Migration: Optimized Order Stats RPC Function
-- Description: Creates a single RPC function to fetch all order statistics in one query
-- Author: Claude Code
-- Date: 2026-01-20

-- Create optimized order stats function
-- Returns all order counts and revenue in a single query instead of 6 separate queries
CREATE OR REPLACE FUNCTION get_order_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_orders', (
      SELECT COUNT(*) FROM orders
    ),
    'pending_orders', (
      SELECT COUNT(*) FROM orders WHERE status = 'pending'
    ),
    'paid_orders', (
      SELECT COUNT(*) FROM orders WHERE status = 'paid'
    ),
    'processing_orders', (
      SELECT COUNT(*) FROM orders WHERE status = 'processing'
    ),
    'shipped_orders', (
      SELECT COUNT(*) FROM orders WHERE status = 'shipped'
    ),
    'total_revenue', COALESCE((
      SELECT SUM(total_idr)
      FROM orders
      WHERE status IN ('paid', 'processing', 'shipped', 'delivered')
    ), 0)
  ) INTO stats;

  RETURN stats;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_order_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_order_stats() IS 'Returns comprehensive order statistics in a single call';
