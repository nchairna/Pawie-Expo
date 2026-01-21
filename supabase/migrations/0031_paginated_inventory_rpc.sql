-- Migration 3: Paginated Inventory RPC Functions
-- Update get_all_products_with_inventory to support pagination and filtering

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_all_products_with_inventory();

-- Create updated function with pagination support
CREATE OR REPLACE FUNCTION get_all_products_with_inventory(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_low_stock_only boolean DEFAULT false,
  p_out_of_stock_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  name text,
  sku text,
  base_price_idr integer,
  published boolean,
  stock_quantity integer,
  low_stock_threshold integer,
  status text,
  updated_at timestamptz,
  primary_image_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    p.id as product_id,
    p.name,
    p.sku,
    p.base_price_idr,
    p.published,
    COALESCE(i.stock_quantity, 0) as stock_quantity,
    COALESCE(i.low_stock_threshold, 10) as low_stock_threshold,
    CASE
      WHEN i.id IS NULL THEN 'no_inventory_record'
      WHEN COALESCE(i.stock_quantity, 0) = 0 THEN 'out_of_stock'
      WHEN COALESCE(i.stock_quantity, 0) <= COALESCE(i.low_stock_threshold, 10) THEN 'low_stock'
      ELSE 'in_stock'
    END as status,
    COALESCE(i.updated_at, p.updated_at) as updated_at,
    p.primary_image_path
  FROM products p
  LEFT JOIN inventory i ON p.id = i.product_id
  WHERE
    (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    AND (NOT p_low_stock_only OR (COALESCE(i.stock_quantity, 0) > 0 AND COALESCE(i.stock_quantity, 0) <= COALESCE(i.low_stock_threshold, 10)))
    AND (NOT p_out_of_stock_only OR COALESCE(i.stock_quantity, 0) = 0)
  ORDER BY updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create function to get total count for pagination
CREATE OR REPLACE FUNCTION get_products_inventory_count(
  p_search text DEFAULT NULL,
  p_low_stock_only boolean DEFAULT false,
  p_out_of_stock_only boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM products p
  LEFT JOIN inventory i ON p.id = i.product_id
  WHERE
    (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    AND (NOT p_low_stock_only OR (COALESCE(i.stock_quantity, 0) > 0 AND COALESCE(i.stock_quantity, 0) <= COALESCE(i.low_stock_threshold, 10)))
    AND (NOT p_out_of_stock_only OR COALESCE(i.stock_quantity, 0) = 0);

  RETURN total_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_all_products_with_inventory(integer, integer, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_inventory_count(text, boolean, boolean) TO authenticated;
