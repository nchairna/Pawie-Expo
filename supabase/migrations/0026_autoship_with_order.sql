-- ============================================
-- Function: create_autoship_with_order
-- Creates autoship subscription AND immediate first order
-- Chewy-style checkout enrollment
-- ============================================

CREATE OR REPLACE FUNCTION public.create_autoship_with_order(
  p_product_id uuid,
  p_quantity integer,
  p_frequency_weeks integer,
  p_address_id uuid,
  p_pet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_product record;
  v_autoship_id uuid;
  v_order_result jsonb;
  v_order_id uuid;
  v_next_run_at timestamptz;
  v_first_run_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'User must be authenticated'
    );
  END IF;

  -- Validate product
  SELECT id, name, autoship_eligible, published, base_price_idr
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_FOUND',
      'message', 'Product does not exist'
    );
  END IF;

  IF NOT v_product.published THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_AVAILABLE',
      'message', 'Product is not available'
    );
  END IF;

  IF NOT v_product.autoship_eligible THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTOSHIP_ELIGIBLE',
      'message', 'Product is not eligible for autoship'
    );
  END IF;

  -- Validate frequency (Chewy-style: 1-12 weeks, plus 16, 20, 24 for longer intervals)
  IF p_frequency_weeks NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_FREQUENCY',
      'message', 'Frequency must be between 1-12 weeks, or 16, 20, 24 weeks'
    );
  END IF;

  -- Validate quantity
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUANTITY',
      'message', 'Quantity must be at least 1'
    );
  END IF;

  -- Check for existing active autoship with exact same configuration
  -- Allow multiple autoships for same product if quantity, frequency, or pet differs
  IF EXISTS (
    SELECT 1 FROM public.autoships
    WHERE user_id = v_user_id
      AND product_id = p_product_id
      AND quantity = p_quantity
      AND frequency_weeks = p_frequency_weeks
      AND COALESCE(pet_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
          COALESCE(p_pet_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_AUTOSHIP',
      'message', 'You already have an active autoship for this product with the same quantity, frequency, and pet. You can create a new autoship with different quantity, frequency, or for a different pet.'
    );
  END IF;

  -- Calculate next run date (first future delivery, NOT today's order)
  v_next_run_at := NOW() + (p_frequency_weeks || ' weeks')::interval;

  -- Step 1: Create the autoship subscription
  INSERT INTO public.autoships (
    user_id,
    product_id,
    quantity,
    frequency_weeks,
    next_run_at,
    pet_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_product_id,
    p_quantity,
    p_frequency_weeks,
    v_next_run_at,
    p_pet_id,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_autoship_id;

  -- Step 2: Create immediate first order with autoship pricing
  -- Use create_order_with_inventory with source = 'autoship'
  SELECT public.create_order_with_inventory(
    v_user_id,  -- User ID (required first parameter)
    jsonb_build_array(
      jsonb_build_object(
        'product_id', p_product_id,
        'quantity', p_quantity,
        'is_autoship', true
      )
    ),
    p_address_id,
    'autoship'
  ) INTO v_order_result;

  -- Check if order creation succeeded
  IF NOT (v_order_result->>'success')::boolean THEN
    -- Rollback: delete the autoship we just created
    DELETE FROM public.autoships WHERE id = v_autoship_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', v_order_result->>'error',
      'message', COALESCE(v_order_result->>'message', 'Failed to create order')
    );
  END IF;

  v_order_id := (v_order_result->>'order_id')::uuid;

  -- Step 3: Record this as the first autoship run (already executed)
  INSERT INTO public.autoship_runs (
    autoship_id,
    scheduled_at,
    executed_at,
    status,
    order_id,
    created_at
  ) VALUES (
    v_autoship_id,
    NOW(),  -- Scheduled for now (immediate)
    NOW(),  -- Executed now
    'completed',
    v_order_id,
    NOW()
  )
  RETURNING id INTO v_first_run_id;

  -- Return success with all details
  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', v_autoship_id,
    'order_id', v_order_id,
    'first_run_id', v_first_run_id,
    'next_run_at', v_next_run_at,
    'product_name', v_product.name,
    'quantity', p_quantity,
    'frequency_weeks', p_frequency_weeks,
    'message', 'Autoship created with immediate first order'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'SYSTEM_ERROR',
    'message', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_autoship_with_order TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_autoship_with_order IS
'Chewy-style autoship enrollment: Creates autoship subscription AND places immediate first order with autoship pricing. Used during checkout when user selects "Subscribe & Save".';
