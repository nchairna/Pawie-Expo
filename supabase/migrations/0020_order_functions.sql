-- Migration: Order Functions (Phase 4, Part A)
-- Purpose: Create backend functions for order management and inventory control
-- Date: 2026-01-09
-- 
-- This migration creates:
-- 1. check_product_availability() - Check inventory availability
-- 2. decrement_inventory() - Transaction-safe inventory decrement
-- 3. create_order_with_inventory() - Atomic order creation
-- 4. update_order_status() - Admin order status updates
-- 5. adjust_inventory() - Admin inventory adjustments
--
-- Also adds shipping_address_id column to orders table if missing

-- ============================================================================
-- Schema Updates
-- ============================================================================

-- Add shipping_address_id column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'shipping_address_id'
  ) THEN
    ALTER TABLE public.orders 
    ADD COLUMN shipping_address_id uuid REFERENCES public.addresses(id);
  END IF;
END $$;

-- ============================================================================
-- Function: check_product_availability
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_product_availability(
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_name text;
  v_product_published boolean;
  v_stock_quantity integer;
  v_available boolean;
BEGIN
  -- Validate inputs
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'INVALID_QUANTITY',
      'product_id', p_product_id
    );
  END IF;

  -- Get product info and check if published
  SELECT name, published
  INTO v_product_name, v_product_published
  FROM public.products
  WHERE id = p_product_id;

  -- Product not found
  IF v_product_name IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'PRODUCT_NOT_FOUND',
      'product_id', p_product_id
    );
  END IF;

  -- Product not published
  IF NOT v_product_published THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'PRODUCT_NOT_PUBLISHED',
      'product_id', p_product_id,
      'product_name', v_product_name
    );
  END IF;

  -- Get current stock (default to 0 if no inventory record exists)
  SELECT COALESCE(stock_quantity, 0)
  INTO v_stock_quantity
  FROM public.inventory
  WHERE product_id = p_product_id;

  -- Check availability
  v_available := v_stock_quantity >= p_quantity;

  -- Return result
  IF v_available THEN
    RETURN jsonb_build_object(
      'available', true,
      'stock_quantity', v_stock_quantity,
      'requested_quantity', p_quantity,
      'product_id', p_product_id,
      'product_name', v_product_name
    );
  ELSE
    RETURN jsonb_build_object(
      'available', false,
      'error', 'INSUFFICIENT_STOCK',
      'stock_quantity', v_stock_quantity,
      'requested_quantity', p_quantity,
      'product_id', p_product_id,
      'product_name', v_product_name
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_product_availability IS 
'Checks if a product has sufficient inventory for the requested quantity. Returns JSONB with availability status, stock quantity, and error details if unavailable.';

-- ============================================================================
-- Function: decrement_inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decrement_inventory(
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
  v_movement_id uuid;
BEGIN
  -- Validate inputs
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity: %', p_quantity;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required for inventory movements';
  END IF;

  -- Lock inventory row for update (prevents race conditions)
  SELECT stock_quantity
  INTO v_current_stock
  FROM public.inventory
  WHERE product_id = p_product_id
  FOR UPDATE;

  -- If no inventory record exists, create one with 0 stock
  IF v_current_stock IS NULL THEN
    INSERT INTO public.inventory (product_id, stock_quantity)
    VALUES (p_product_id, 0)
    ON CONFLICT (product_id) DO NOTHING
    RETURNING stock_quantity INTO v_current_stock;
    
    -- If still null after insert, product doesn't exist
    IF v_current_stock IS NULL THEN
      SELECT stock_quantity INTO v_current_stock
      FROM public.inventory
      WHERE product_id = p_product_id;
    END IF;
  END IF;

  -- Check if sufficient stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock - p_quantity;

  -- Update inventory
  UPDATE public.inventory
  SET 
    stock_quantity = v_new_stock,
    updated_at = NOW()
  WHERE product_id = p_product_id;

  -- Create inventory movement record (audit log)
  INSERT INTO public.inventory_movements (
    product_id,
    change_quantity,
    reason,
    reference_id
  )
  VALUES (
    p_product_id,
    -p_quantity,  -- Negative for decrement
    p_reason,
    p_reference_id
  )
  RETURNING id INTO v_movement_id;

  -- Return confirmation
  RETURN jsonb_build_object(
    'success', true,
    'new_stock', v_new_stock,
    'previous_stock', v_current_stock,
    'decremented', p_quantity,
    'movement_id', v_movement_id
  );
END;
$$;

COMMENT ON FUNCTION public.decrement_inventory IS 
'Decrements inventory for a product in a transaction-safe manner. Uses row-level locking to prevent race conditions. Creates audit log entry in inventory_movements.';

-- ============================================================================
-- Function: create_order_with_inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order_with_inventory(
  p_user_id uuid,
  p_items jsonb,  -- [{ "product_id": "uuid", "quantity": 2 }, ...]
  p_address_id uuid DEFAULT NULL,
  p_source text DEFAULT 'one_time'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_pricing_result jsonb;
  v_subtotal_idr integer := 0;
  v_discount_total_idr integer := 0;
  v_total_idr integer := 0;
  v_item_subtotal integer;
  v_item_discount integer;
  v_item_total integer;
  v_order_item_id uuid;
  v_items_result jsonb := '[]'::jsonb;
  v_availability_result jsonb;
  v_is_autoship boolean;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_FOUND',
      'user_id', p_user_id
    );
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EMPTY_ORDER'
    );
  END IF;

  -- Validate source
  IF p_source NOT IN ('one_time', 'autoship') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_SOURCE',
      'source', p_source
    );
  END IF;

  v_is_autoship := (p_source = 'autoship');

  -- Pre-validate all products and inventory availability
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Validate quantity
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_QUANTITY',
        'product_id', v_product_id
      );
    END IF;

    -- Check product exists and is published
    IF NOT EXISTS (
      SELECT 1 FROM public.products 
      WHERE id = v_product_id AND published = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'PRODUCT_NOT_FOUND',
        'product_id', v_product_id
      );
    END IF;

    -- Check inventory availability
    v_availability_result := public.check_product_availability(v_product_id, v_quantity);
    IF (v_availability_result->>'available')::boolean = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_INVENTORY',
        'product_id', v_product_id,
        'available', (v_availability_result->>'stock_quantity')::integer,
        'requested', v_quantity
      );
    END IF;
  END LOOP;

  -- All validations passed, proceed with order creation
  -- Compute pricing for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Compute price using Phase 3 pricing function
    v_pricing_result := public.compute_product_price(
      v_product_id,
      p_user_id,
      v_is_autoship,
      v_quantity
    );

    -- Calculate item totals
    v_item_subtotal := (v_pricing_result->>'base_price_idr')::integer * v_quantity;
    v_item_discount := (v_pricing_result->>'discount_total_idr')::integer * v_quantity;
    v_item_total := (v_pricing_result->>'line_total_idr')::integer;

    -- Accumulate order totals
    v_subtotal_idr := v_subtotal_idr + v_item_subtotal;
    v_discount_total_idr := v_discount_total_idr + v_item_discount;
    v_total_idr := v_total_idr + v_item_total;
  END LOOP;

  -- Create order
  INSERT INTO public.orders (
    user_id,
    status,
    source,
    subtotal_idr,
    discount_total_idr,
    total_idr,
    shipping_address_id
  )
  VALUES (
    p_user_id,
    'pending',
    p_source,
    v_subtotal_idr,
    v_discount_total_idr,
    v_total_idr,
    p_address_id
  )
  RETURNING id INTO v_order_id;

  -- Create order items and decrement inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Compute price again for this item
    v_pricing_result := public.compute_product_price(
      v_product_id,
      p_user_id,
      v_is_autoship,
      v_quantity
    );

    -- Create order item with price snapshot
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_base_price_idr,
      unit_final_price_idr,
      discount_total_idr,
      discount_breakdown
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_quantity,
      (v_pricing_result->>'base_price_idr')::integer,
      (v_pricing_result->>'final_price_idr')::integer,
      (v_pricing_result->>'discount_total_idr')::integer,
      v_pricing_result->'discounts_applied'
    )
    RETURNING id INTO v_order_item_id;

    -- Decrement inventory (transaction-safe)
    PERFORM public.decrement_inventory(
      v_product_id,
      v_quantity,
      'order_placed',
      v_order_id
    );

    -- Add to items result
    v_items_result := v_items_result || jsonb_build_object(
      'order_item_id', v_order_item_id,
      'product_id', v_product_id,
      'quantity', v_quantity,
      'pricing', v_pricing_result
    );
  END LOOP;

  -- Return order confirmation
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', 'pending',
    'subtotal_idr', v_subtotal_idr,
    'discount_total_idr', v_discount_total_idr,
    'total_price_idr', v_total_idr,
    'items', v_items_result
  );
END;
$$;

COMMENT ON FUNCTION public.create_order_with_inventory IS 
'Creates an order atomically with inventory decrement. Validates all products and inventory before creating order. Uses price snapshots from compute_product_price(). Entire operation is transaction-safe.';

-- ============================================================================
-- Function: update_order_status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_status text;
  v_order_item RECORD;
  v_restored_count integer := 0;
BEGIN
  -- Validate order exists
  SELECT status
  INTO v_current_status
  FROM public.orders
  WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND',
      'order_id', p_order_id
    );
  END IF;

  -- Validate status transition
  -- Valid transitions:
  -- pending → paid, cancelled
  -- paid → processing, refunded
  -- processing → shipped, refunded
  -- shipped → delivered
  -- (cancelled and refunded are terminal)
  
  IF v_current_status = 'cancelled' OR v_current_status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Cannot change status from terminal state'
    );
  END IF;

  IF v_current_status = 'pending' AND p_new_status NOT IN ('paid', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Pending orders can only transition to paid or cancelled'
    );
  END IF;

  IF v_current_status = 'paid' AND p_new_status NOT IN ('processing', 'refunded') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Paid orders can only transition to processing or refunded'
    );
  END IF;

  IF v_current_status = 'processing' AND p_new_status NOT IN ('shipped', 'refunded') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Processing orders can only transition to shipped or refunded'
    );
  END IF;

  IF v_current_status = 'shipped' AND p_new_status != 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Shipped orders can only transition to delivered'
    );
  END IF;

  IF v_current_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'current_status', v_current_status,
      'new_status', p_new_status,
      'message', 'Delivered is a terminal state'
    );
  END IF;

  -- Handle cancellation: restore inventory
  IF p_new_status = 'cancelled' AND v_current_status = 'pending' THEN
    -- Restore inventory for all order items
    FOR v_order_item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = p_order_id
    LOOP
      -- Get or create inventory record
      INSERT INTO public.inventory (product_id, stock_quantity)
      VALUES (v_order_item.product_id, v_order_item.quantity)
      ON CONFLICT (product_id) 
      DO UPDATE SET 
        stock_quantity = public.inventory.stock_quantity + v_order_item.quantity,
        updated_at = NOW();

      -- Create inventory movement record (audit log)
      INSERT INTO public.inventory_movements (
        product_id,
        change_quantity,
        reason,
        reference_id
      )
      VALUES (
        v_order_item.product_id,
        v_order_item.quantity,  -- Positive for restoration
        'order_cancelled',
        p_order_id
      );

      v_restored_count := v_restored_count + 1;
    END LOOP;
  END IF;

  -- Update order status
  UPDATE public.orders
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return confirmation
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'previous_status', v_current_status,
    'new_status', p_new_status,
    'inventory_restored', CASE WHEN p_new_status = 'cancelled' THEN v_restored_count ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION public.update_order_status IS 
'Updates order status with validation of allowed transitions. Restores inventory when cancelling pending orders.';

-- ============================================================================
-- Function: adjust_inventory (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_adjustment integer,  -- positive = add, negative = remove
  p_reason text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
  v_movement_id uuid;
BEGIN
  -- Validate inputs
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required for inventory adjustments';
  END IF;

  IF p_adjustment = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_ADJUSTMENT',
      'message', 'Adjustment cannot be zero'
    );
  END IF;

  -- Validate product exists
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_FOUND',
      'product_id', p_product_id
    );
  END IF;

  -- Get or create inventory record
  SELECT stock_quantity
  INTO v_current_stock
  FROM public.inventory
  WHERE product_id = p_product_id;

  -- If no inventory record exists, create one
  IF v_current_stock IS NULL THEN
    INSERT INTO public.inventory (product_id, stock_quantity)
    VALUES (p_product_id, 0)
    ON CONFLICT (product_id) DO NOTHING;
    
    -- Re-fetch after potential insert
    SELECT stock_quantity INTO v_current_stock
    FROM public.inventory
    WHERE product_id = p_product_id;
    
    -- Should not be null after insert, but check anyway
    IF v_current_stock IS NULL THEN
      v_current_stock := 0;
    END IF;
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock + p_adjustment;

  -- Validate new stock >= 0
  IF v_new_stock < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'current_stock', v_current_stock,
      'adjustment', p_adjustment,
      'would_result_in', v_new_stock,
      'message', 'Inventory cannot go negative'
    );
  END IF;

  -- Update inventory
  UPDATE public.inventory
  SET 
    stock_quantity = v_new_stock,
    updated_at = NOW()
  WHERE product_id = p_product_id;

  -- Create inventory movement record
  INSERT INTO public.inventory_movements (
    product_id,
    change_quantity,
    reason,
    reference_id
  )
  VALUES (
    p_product_id,
    p_adjustment,
    p_reason,
    p_reference_id
  )
  RETURNING id INTO v_movement_id;

  -- Return confirmation
  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'adjustment', p_adjustment,
    'new_stock', v_new_stock,
    'movement_id', v_movement_id
  );
END;
$$;

COMMENT ON FUNCTION public.adjust_inventory IS 
'Admin function to adjust inventory (add or remove stock). Prevents negative inventory. Creates audit log entry. Used for restocking, corrections, returns, etc.';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_product_availability TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.decrement_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory TO authenticated;
