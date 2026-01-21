-- Migration: Fix Dashboard Stats RPC Function
-- Description: Fixes column name from next_execution_date to next_run_at
-- Date: 2026-01-18

-- Drop and recreate the function with correct column name
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- Order counts by time period
    'orders_today', (
      SELECT COUNT(*)
      FROM orders
      WHERE created_at::date = CURRENT_DATE
    ),
    'orders_this_week', (
      SELECT COUNT(*)
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    'orders_this_month', (
      SELECT COUNT(*)
      FROM orders
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    ),

    -- Revenue by time period (only paid/processing/shipped/delivered)
    'revenue_today', COALESCE((
      SELECT SUM(total_idr)
      FROM orders
      WHERE created_at::date = CURRENT_DATE
        AND status IN ('paid', 'processing', 'shipped', 'delivered')
    ), 0),
    'revenue_this_week', COALESCE((
      SELECT SUM(total_idr)
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND status IN ('paid', 'processing', 'shipped', 'delivered')
    ), 0),
    'revenue_this_month', COALESCE((
      SELECT SUM(total_idr)
      FROM orders
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
        AND status IN ('paid', 'processing', 'shipped', 'delivered')
    ), 0),

    -- Order counts by status
    'pending_orders', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'pending'
    ),
    'paid_orders', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'paid'
    ),
    'processing_orders', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'processing'
    ),
    'shipped_orders', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'shipped'
    ),

    -- Inventory alerts
    'out_of_stock_count', (
      SELECT COUNT(*)
      FROM inventory
      WHERE stock_quantity = 0
    ),
    'low_stock_count', (
      SELECT COUNT(*)
      FROM inventory
      WHERE stock_quantity > 0
        AND stock_quantity <= COALESCE(low_stock_threshold, 10)
    ),

    -- Autoship stats (using correct column name: next_run_at)
    'active_autoships', (
      SELECT COUNT(*)
      FROM autoships
      WHERE status = 'active'
    ),
    'autoships_due_today', (
      SELECT COUNT(*)
      FROM autoships
      WHERE next_run_at::date = CURRENT_DATE
        AND status = 'active'
    )
  ) INTO stats;

  RETURN stats;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
