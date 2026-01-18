-- ============================================================================
-- Migration: 0025_autoship_functions.sql
-- Description: Autoship subscription management functions
-- Created: 2026-01-17
-- Phase: Phase 5 - Autoship System
-- ============================================================================

-- ============================================================================
-- Helper function: Get user's default or most recent address
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_default_address(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_address_id uuid;
BEGIN
  -- Try to get default address first
  SELECT id INTO v_address_id
  FROM public.addresses
  WHERE user_id = p_user_id AND is_default = true
  LIMIT 1;

  -- If no default, get most recently created address
  IF v_address_id IS NULL THEN
    SELECT id INTO v_address_id
    FROM public.addresses
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_address_id;
END;
$$;

-- ============================================================================
-- Function: create_autoship
-- Description: Create a new autoship subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_autoship(
  p_product_id uuid,
  p_quantity integer,
  p_frequency_weeks integer,
  p_pet_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL
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
  v_next_run_at timestamptz;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Validate product exists, is published, and autoship eligible
  SELECT id, name, base_price_idr, published, autoship_eligible
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_FOUND'
    );
  END IF;

  IF NOT v_product.published THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_PUBLISHED'
    );
  END IF;

  IF NOT v_product.autoship_eligible THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRODUCT_NOT_AUTOSHIP_ELIGIBLE'
    );
  END IF;

  -- Validate quantity
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUANTITY'
    );
  END IF;

  -- Validate frequency is in allowed range
  IF p_frequency_weeks NOT IN (1, 2, 4, 6, 8, 12) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_FREQUENCY',
      'allowed_values', ARRAY[1, 2, 4, 6, 8, 12]
    );
  END IF;

  -- Check for duplicate active autoship for same product
  IF EXISTS (
    SELECT 1 FROM public.autoships
    WHERE user_id = v_user_id
      AND product_id = p_product_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_AUTOSHIP',
      'message', 'You already have an active autoship for this product'
    );
  END IF;

  -- If pet_id provided, validate it belongs to user
  IF p_pet_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pets
      WHERE id = p_pet_id AND user_id = v_user_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'PET_NOT_FOUND'
      );
    END IF;
  END IF;

  -- Calculate next_run_at
  IF p_start_date IS NOT NULL THEN
    v_next_run_at := p_start_date;
  ELSE
    v_next_run_at := NOW() + (p_frequency_weeks || ' weeks')::interval;
  END IF;

  -- Create autoship record
  INSERT INTO public.autoships (
    user_id,
    pet_id,
    product_id,
    quantity,
    frequency_weeks,
    next_run_at,
    status
  ) VALUES (
    v_user_id,
    p_pet_id,
    p_product_id,
    p_quantity,
    p_frequency_weeks,
    v_next_run_at,
    'active'
  )
  RETURNING id INTO v_autoship_id;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', v_autoship_id,
    'next_run_at', v_next_run_at,
    'product_name', v_product.name,
    'quantity', p_quantity,
    'frequency_weeks', p_frequency_weeks
  );
END;
$$;

-- ============================================================================
-- Function: update_autoship
-- Description: Update autoship quantity and/or frequency
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_autoship(
  p_autoship_id uuid,
  p_quantity integer DEFAULT NULL,
  p_frequency_weeks integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_autoship record;
  v_updated_fields text[] := '{}';
  v_new_next_run_at timestamptz;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Get autoship and verify ownership
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Cannot update cancelled autoship
  IF v_autoship.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_CANCELLED',
      'message', 'Cannot update a cancelled autoship'
    );
  END IF;

  -- Validate and update quantity if provided
  IF p_quantity IS NOT NULL THEN
    IF p_quantity <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_QUANTITY'
      );
    END IF;

    UPDATE public.autoships
    SET quantity = p_quantity, updated_at = NOW()
    WHERE id = p_autoship_id;

    v_updated_fields := array_append(v_updated_fields, 'quantity');
  END IF;

  -- Validate and update frequency if provided
  IF p_frequency_weeks IS NOT NULL THEN
    IF p_frequency_weeks NOT IN (1, 2, 4, 6, 8, 12) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_FREQUENCY',
        'allowed_values', ARRAY[1, 2, 4, 6, 8, 12]
      );
    END IF;

    -- Recalculate next_run_at based on new frequency
    v_new_next_run_at := NOW() + (p_frequency_weeks || ' weeks')::interval;

    UPDATE public.autoships
    SET frequency_weeks = p_frequency_weeks,
        next_run_at = v_new_next_run_at,
        updated_at = NOW()
    WHERE id = p_autoship_id;

    v_updated_fields := array_append(v_updated_fields, 'frequency_weeks');
  ELSE
    v_new_next_run_at := v_autoship.next_run_at;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', p_autoship_id,
    'updated_fields', v_updated_fields,
    'new_next_run_at', v_new_next_run_at
  );
END;
$$;

-- ============================================================================
-- Function: pause_autoship
-- Description: Pause an active autoship
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pause_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_autoship record;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Get autoship and verify ownership
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Validate current status
  IF v_autoship.status = 'paused' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_PAUSED',
      'message', 'Autoship is already paused'
    );
  END IF;

  IF v_autoship.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_CANCELLED',
      'message', 'Cannot pause a cancelled autoship'
    );
  END IF;

  -- Pause the autoship
  UPDATE public.autoships
  SET status = 'paused', updated_at = NOW()
  WHERE id = p_autoship_id;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', p_autoship_id,
    'status', 'paused'
  );
END;
$$;

-- ============================================================================
-- Function: resume_autoship
-- Description: Resume a paused autoship
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resume_autoship(
  p_autoship_id uuid,
  p_next_run_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_autoship record;
  v_new_next_run_at timestamptz;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Get autoship and verify ownership
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Validate current status
  IF v_autoship.status = 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ACTIVE',
      'message', 'Autoship is already active'
    );
  END IF;

  IF v_autoship.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_CANCELLED',
      'message', 'Cannot resume a cancelled autoship'
    );
  END IF;

  -- Calculate new next_run_at
  IF p_next_run_at IS NOT NULL THEN
    v_new_next_run_at := p_next_run_at;
  ELSE
    v_new_next_run_at := NOW() + (v_autoship.frequency_weeks || ' weeks')::interval;
  END IF;

  -- Resume the autoship
  UPDATE public.autoships
  SET status = 'active',
      next_run_at = v_new_next_run_at,
      updated_at = NOW()
  WHERE id = p_autoship_id;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', p_autoship_id,
    'status', 'active',
    'next_run_at', v_new_next_run_at
  );
END;
$$;

-- ============================================================================
-- Function: cancel_autoship
-- Description: Permanently cancel an autoship
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_autoship record;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Get autoship and verify ownership
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Validate current status
  IF v_autoship.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CANCELLED',
      'message', 'Autoship is already cancelled'
    );
  END IF;

  -- Cancel the autoship
  UPDATE public.autoships
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_autoship_id;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', p_autoship_id,
    'status', 'cancelled'
  );
END;
$$;

-- ============================================================================
-- Function: skip_next_autoship
-- Description: Skip the next scheduled delivery
-- ============================================================================

CREATE OR REPLACE FUNCTION public.skip_next_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_autoship record;
  v_run_id uuid;
  v_new_next_run_at timestamptz;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHENTICATED'
    );
  END IF;

  -- Get autoship and verify ownership
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Can only skip active autoships
  IF v_autoship.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_ACTIVE',
      'message', 'Can only skip active autoships'
    );
  END IF;

  -- Create skipped run record
  INSERT INTO public.autoship_runs (
    autoship_id,
    scheduled_at,
    status
  ) VALUES (
    p_autoship_id,
    v_autoship.next_run_at,
    'skipped'
  )
  RETURNING id INTO v_run_id;

  -- Advance next_run_at by frequency
  v_new_next_run_at := v_autoship.next_run_at + (v_autoship.frequency_weeks || ' weeks')::interval;

  UPDATE public.autoships
  SET next_run_at = v_new_next_run_at, updated_at = NOW()
  WHERE id = p_autoship_id;

  RETURN jsonb_build_object(
    'success', true,
    'autoship_id', p_autoship_id,
    'run_id', v_run_id,
    'skipped_date', v_autoship.next_run_at,
    'new_next_run_at', v_new_next_run_at
  );
END;
$$;

-- ============================================================================
-- Function: execute_autoship
-- Description: Execute a single autoship (creates order with autoship pricing)
-- CRITICAL: Must be idempotent - running twice for same scheduled_at must not create duplicate orders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_autoship(
  p_autoship_id uuid,
  p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_autoship record;
  v_existing_run record;
  v_run_id uuid;
  v_order_result jsonb;
  v_address_id uuid;
  v_items jsonb;
  v_new_next_run_at timestamptz;
  v_scheduled_date date;
BEGIN
  -- Normalize scheduled_at to date for idempotency key (cast to date is immutable)
  v_scheduled_date := p_scheduled_at::date;

  -- Check if run already exists for this autoship_id + scheduled date (IDEMPOTENCY CHECK)
  SELECT * INTO v_existing_run
  FROM public.autoship_runs
  WHERE autoship_id = p_autoship_id
    AND scheduled_at::date = v_scheduled_date;

  -- If run exists and completed, return existing result (idempotent)
  IF FOUND AND v_existing_run.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'autoship_id', p_autoship_id,
      'order_id', v_existing_run.order_id,
      'run_id', v_existing_run.id,
      'already_executed', true
    );
  END IF;

  -- If run exists and skipped, return skipped status
  IF FOUND AND v_existing_run.status = 'skipped' THEN
    RETURN jsonb_build_object(
      'success', false,
      'autoship_id', p_autoship_id,
      'run_id', v_existing_run.id,
      'error', 'SKIPPED',
      'message', 'This delivery was skipped by user'
    );
  END IF;

  -- Get autoship details
  SELECT * INTO v_autoship
  FROM public.autoships
  WHERE id = p_autoship_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_FOUND'
    );
  END IF;

  -- Validate autoship is active
  IF v_autoship.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTOSHIP_NOT_ACTIVE',
      'status', v_autoship.status
    );
  END IF;

  -- Get user's default address
  v_address_id := public.get_user_default_address(v_autoship.user_id);

  IF v_address_id IS NULL THEN
    -- Create or update failed run record
    IF FOUND THEN
      UPDATE public.autoship_runs
      SET status = 'failed',
          error_message = 'No delivery address found for user',
          executed_at = NOW()
      WHERE id = v_existing_run.id
      RETURNING id INTO v_run_id;
    ELSE
      INSERT INTO public.autoship_runs (
        autoship_id,
        scheduled_at,
        status,
        error_message,
        executed_at
      ) VALUES (
        p_autoship_id,
        p_scheduled_at,
        'failed',
        'No delivery address found for user',
        NOW()
      )
      RETURNING id INTO v_run_id;
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_ADDRESS',
      'run_id', v_run_id
    );
  END IF;

  -- Create or update pending run record
  IF FOUND AND v_existing_run.status = 'failed' THEN
    -- Update existing failed run to pending for retry
    UPDATE public.autoship_runs
    SET status = 'pending',
        error_message = NULL
    WHERE id = v_existing_run.id
    RETURNING id INTO v_run_id;
  ELSIF NOT FOUND THEN
    -- Create new run record
    INSERT INTO public.autoship_runs (
      autoship_id,
      scheduled_at,
      status
    ) VALUES (
      p_autoship_id,
      p_scheduled_at,
      'pending'
    )
    RETURNING id INTO v_run_id;
  ELSE
    v_run_id := v_existing_run.id;
  END IF;

  -- Prepare items array for order creation
  v_items := jsonb_build_array(
    jsonb_build_object(
      'product_id', v_autoship.product_id::text,
      'quantity', v_autoship.quantity
    )
  );

  -- Call create_order_with_inventory with source = 'autoship'
  v_order_result := public.create_order_with_inventory(
    v_autoship.user_id,
    v_items,
    v_address_id,
    'autoship'
  );

  -- Check if order creation succeeded
  IF (v_order_result->>'success')::boolean = true THEN
    -- Calculate new next_run_at
    v_new_next_run_at := p_scheduled_at + (v_autoship.frequency_weeks || ' weeks')::interval;

    -- Update run record as completed
    UPDATE public.autoship_runs
    SET status = 'completed',
        order_id = (v_order_result->>'order_id')::uuid,
        executed_at = NOW()
    WHERE id = v_run_id;

    -- Update autoship next_run_at (advance schedule)
    UPDATE public.autoships
    SET next_run_at = v_new_next_run_at,
        updated_at = NOW()
    WHERE id = p_autoship_id;

    RETURN jsonb_build_object(
      'success', true,
      'autoship_id', p_autoship_id,
      'order_id', (v_order_result->>'order_id')::uuid,
      'run_id', v_run_id,
      'already_executed', false,
      'next_run_at', v_new_next_run_at
    );
  ELSE
    -- Order creation failed, update run record
    UPDATE public.autoship_runs
    SET status = 'failed',
        error_message = COALESCE(v_order_result->>'error', 'Order creation failed'),
        executed_at = NOW()
    WHERE id = v_run_id;

    -- DO NOT advance next_run_at on failure

    RETURN jsonb_build_object(
      'success', false,
      'autoship_id', p_autoship_id,
      'run_id', v_run_id,
      'error', v_order_result->>'error',
      'message', v_order_result
    );
  END IF;
END;
$$;

-- ============================================================================
-- Function: run_due_autoships
-- Description: Find and execute all autoships due for execution
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_due_autoships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_autoship record;
  v_result jsonb;
  v_total_due integer := 0;
  v_executed integer := 0;
  v_failed integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Find all autoships due for execution
  FOR v_autoship IN
    SELECT id, next_run_at
    FROM public.autoships
    WHERE status = 'active'
      AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
  LOOP
    v_total_due := v_total_due + 1;

    -- Execute the autoship
    v_result := public.execute_autoship(v_autoship.id, v_autoship.next_run_at);

    -- Track success/failure
    IF (v_result->>'success')::boolean = true THEN
      v_executed := v_executed + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;

    -- Add result to array
    v_results := v_results || jsonb_build_object(
      'autoship_id', v_autoship.id,
      'scheduled_at', v_autoship.next_run_at,
      'result', v_result
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_due', v_total_due,
    'executed', v_executed,
    'failed', v_failed,
    'results', v_results
  );
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_default_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_autoship(uuid, integer, integer, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_autoship(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_autoship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_autoship(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_autoship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_next_autoship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_autoship(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_due_autoships() TO authenticated;

-- ============================================================================
-- Indexes for autoship performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS autoships_user_id_idx ON public.autoships(user_id);
CREATE INDEX IF NOT EXISTS autoships_product_id_idx ON public.autoships(product_id);
CREATE INDEX IF NOT EXISTS autoships_status_idx ON public.autoships(status);
CREATE INDEX IF NOT EXISTS autoships_next_run_at_idx ON public.autoships(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS autoships_user_product_active_idx ON public.autoships(user_id, product_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS autoship_runs_autoship_id_idx ON public.autoship_runs(autoship_id);
CREATE INDEX IF NOT EXISTS autoship_runs_scheduled_at_idx ON public.autoship_runs(scheduled_at);
CREATE INDEX IF NOT EXISTS autoship_runs_status_idx ON public.autoship_runs(status);
CREATE INDEX IF NOT EXISTS autoship_runs_order_id_idx ON public.autoship_runs(order_id);
-- Composite index for idempotency checks (PostgreSQL can use this with the date cast in queries)
CREATE INDEX IF NOT EXISTS autoship_runs_autoship_scheduled_idx ON public.autoship_runs(autoship_id, scheduled_at);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.create_autoship IS 'Create a new autoship subscription for a product';
COMMENT ON FUNCTION public.update_autoship IS 'Update autoship quantity and/or frequency';
COMMENT ON FUNCTION public.pause_autoship IS 'Pause an active autoship';
COMMENT ON FUNCTION public.resume_autoship IS 'Resume a paused autoship';
COMMENT ON FUNCTION public.cancel_autoship IS 'Permanently cancel an autoship';
COMMENT ON FUNCTION public.skip_next_autoship IS 'Skip the next scheduled delivery';
COMMENT ON FUNCTION public.execute_autoship IS 'Execute a single autoship (idempotent) - creates order with autoship pricing';
COMMENT ON FUNCTION public.run_due_autoships IS 'Find and execute all autoships due for execution (scheduler function)';
