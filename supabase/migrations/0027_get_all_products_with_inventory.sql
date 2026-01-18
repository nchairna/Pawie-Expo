-- ============================================================================
-- Migration: 0027_get_all_products_with_inventory
-- Purpose: Create function to get all products with inventory (LEFT JOIN)
--          This allows showing products without inventory records
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_products_with_inventory(
  p_low_stock boolean DEFAULT false,
  p_out_of_stock boolean DEFAULT false,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Build and execute query with LEFT JOIN
  -- Use subquery to handle ORDER BY before aggregation
  WITH ordered_products AS (
    SELECT 
      p.id as product_id,
      p.name,
      p.primary_image_path,
      p.sku,
      p.published,
      p.updated_at as product_updated_at,
      inv.id as inventory_id,
      COALESCE(inv.stock_quantity, 0) as stock_quantity,
      inv.updated_at as inventory_updated_at
    FROM public.products p
    LEFT JOIN public.inventory inv ON inv.product_id = p.id
    WHERE 
      (p_low_stock = false AND p_out_of_stock = false) OR
      (p_out_of_stock = true AND COALESCE(inv.stock_quantity, 0) = 0) OR
      (p_low_stock = true AND COALESCE(inv.stock_quantity, 0) > 0 AND COALESCE(inv.stock_quantity, 0) <= 10)
      AND (p_search IS NULL OR trim(p_search) = '' OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
    ORDER BY COALESCE(inv.updated_at, p.updated_at) DESC
    LIMIT CASE WHEN p_limit IS NOT NULL THEN p_limit ELSE NULL END
    OFFSET p_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', op.inventory_id::text,
      'product_id', op.product_id,
      'stock_quantity', op.stock_quantity,
      'updated_at', COALESCE(op.inventory_updated_at::text, op.product_updated_at::text),
      'product', jsonb_build_object(
        'id', op.product_id,
        'name', op.name,
        'primary_image_path', op.primary_image_path,
        'sku', op.sku,
        'published', op.published
      )
    )
  )
  INTO v_result
  FROM ordered_products op;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_products_with_inventory TO authenticated;

COMMENT ON FUNCTION public.get_all_products_with_inventory IS
'Returns all products with their inventory data (LEFT JOIN). Products without inventory records appear with stock_quantity = 0 and id = null. Supports filtering by stock status and search.';
