# Phase 5 Enhancement: Chewy-Style Autoship Enrollment During Checkout

**Feature**: Allow users to enroll in autoship subscriptions directly from checkout with immediate first delivery
**Status**: Ready for Implementation
**Priority**: High
**Date**: 2026-01-17

---

## Overview

Implement Chewy-style autoship enrollment during checkout. Unlike the current product-page-only enrollment (which creates a subscription with future first delivery), this approach:

1. **Immediate First Order**: When user selects autoship during checkout, the first order is placed immediately with autoship discount
2. **Subscription Created**: Autoship subscription is created with `next_run_at` set to `checkout_date + frequency_weeks`
3. **Mixed Cart Support**: User can mix autoship and one-time items in the same checkout
4. **Clear Savings Display**: Show exact savings for subscribing vs one-time purchase

### Chewy's Actual Flow (What We're Implementing)

1. User adds products to cart
2. User proceeds to checkout
3. For each autoship-eligible product in cart:
   - Default: One-time purchase (no subscription)
   - Toggle: "Subscribe & Save X%" with frequency selector
   - When toggled ON: Shows autoship price and frequency options
4. User selects address and places order
5. **On "Place Order"**:
   - **Autoship items**: Create order NOW with autoship pricing + create autoship subscription for future deliveries
   - **One-time items**: Create regular order
6. Confirmation shows: Order summary + "Your subscriptions have been created"

### Key Difference from Current Implementation

| Aspect | Current (Product Page) | Chewy-Style (Checkout) |
|--------|------------------------|------------------------|
| When enrolled | Product detail page | During checkout |
| First order | Waits for `next_run_at` | **Placed immediately** |
| Autoship discount | Applied on first scheduled delivery | **Applied on immediate order** |
| User gets product | After frequency period | **Right away** |

---

## User Flow

```
Cart (2 items)
├── Product A (autoship-eligible)
│   └── [x] Subscribe & Save 10%
│       └── Deliver: [Every 4 weeks ▼]  ← Dropdown with 13 options
│       └── Rp 135,000 per delivery (save Rp 15,000)
│       └── Next delivery: Feb 14, 2026
└── Product B (not eligible)
    └── Rp 50,000

Summary:
├── Today's Order: Rp 185,000 (Rp 135,000 + Rp 50,000)
├── You Save: Rp 15,000 with autoship
└── Next Product A delivery: Feb 14, 2026

[Place Order]
```

**Frequency Options (Chewy-style):**
- Every week (1)
- Every 2 weeks
- Every 3 weeks
- Every 4 weeks (default)
- Every 5 weeks
- Every 6 weeks
- Every 7 weeks
- Every 8 weeks
- Every 10 weeks
- Every 12 weeks
- Every 16 weeks
- Every 20 weeks
- Every 24 weeks

**After Place Order:**
- Order #1234 created with 2 items (Product A at autoship price, Product B at regular price)
- Autoship subscription created for Product A, next delivery Feb 14, 2026

---

## Implementation Plan

### Files to Modify

1. **`apps/mobile/contexts/CartContext.tsx`** - Add `autoship_eligible` to CartItem
2. **`apps/mobile/app/checkout/index.tsx`** - Main implementation (UI + logic)
3. **`apps/mobile/lib/autoships.ts`** - Add `createAutoshipWithOrder()` function
4. **`supabase/migrations/0026_autoship_with_order.sql`** - Backend function for atomic creation

---

## Step 1: Backend Function - Create Autoship With Immediate Order

**File**: `supabase/migrations/0026_autoship_with_order.sql`

This function atomically creates both the autoship subscription AND the first order in a single transaction.

```sql
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
  SELECT id, name, autoship_eligible, is_published, base_price_idr
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

  IF NOT v_product.is_published THEN
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

  -- Check for existing active autoship for this product
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
```

---

## Step 2: Update CartItem Type

**File**: `apps/mobile/contexts/CartContext.tsx`

Add `autoship_eligible` to the CartItem product info:

```typescript
// Around line 14-23 - Update CartItem interface
export interface CartItem {
  product_id: string;
  quantity: number;
  product: {
    name: string;
    primary_image_path: string | null;
    base_price_idr: number;
    sku: string | null;
    autoship_eligible?: boolean; // ADD THIS
  };
}
```

Update `addItem()` function to fetch and store `autoship_eligible` (around line 154-185):

```typescript
const product = await getProduct(productId);
const cartItem: CartItem = {
  product_id: productId,
  quantity,
  product: {
    name: product.name,
    primary_image_path: product.primary_image_path,
    base_price_idr: product.base_price_idr || 0,
    sku: product.sku,
    autoship_eligible: product.autoship_eligible ?? false, // ADD THIS
  },
};
```

---

## Step 3: Add Mobile Autoship Function

**File**: `apps/mobile/lib/autoships.ts`

Add a new function that calls the backend function:

```typescript
/**
 * Chewy-style: Create autoship with immediate first order
 * Used during checkout when user selects "Subscribe & Save"
 */
export async function createAutoshipWithOrder(params: {
  productId: string;
  quantity: number;
  frequencyWeeks: number;
  addressId: string;
  petId?: string;
}): Promise<{
  success: boolean;
  autoship_id?: string;
  order_id?: string;
  next_run_at?: string;
  error?: string;
  message?: string;
}> {
  const { data, error } = await supabase.rpc('create_autoship_with_order', {
    p_product_id: params.productId,
    p_quantity: params.quantity,
    p_frequency_weeks: params.frequencyWeeks,
    p_address_id: params.addressId,
    p_pet_id: params.petId || null,
  });

  if (error) {
    return {
      success: false,
      error: 'RPC_ERROR',
      message: error.message,
    };
  }

  return data as {
    success: boolean;
    autoship_id?: string;
    order_id?: string;
    next_run_at?: string;
    error?: string;
    message?: string;
  };
}
```

---

## Step 4: Update Checkout Screen

**File**: `apps/mobile/app/checkout/index.tsx`

### 4.1 Add Imports

```typescript
import { createAutoshipWithOrder } from '@/lib/autoships';
import { MaterialIcons } from '@expo/vector-icons';
```

### 4.2 Add State Variables

After existing state declarations (around line 60):

```typescript
// Autoship selection state - tracks which items user wants as subscriptions
const [autoshipSelections, setAutoshipSelections] = useState<Record<string, {
  enabled: boolean;
  frequency: number; // 1-12, 16, 20, or 24 weeks (Chewy-style options)
}>>({});

// Frequency options (Chewy-style)
const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Every week' },
  { value: 2, label: 'Every 2 weeks' },
  { value: 3, label: 'Every 3 weeks' },
  { value: 4, label: 'Every 4 weeks' },
  { value: 5, label: 'Every 5 weeks' },
  { value: 6, label: 'Every 6 weeks' },
  { value: 7, label: 'Every 7 weeks' },
  { value: 8, label: 'Every 8 weeks' },
  { value: 10, label: 'Every 10 weeks' },
  { value: 12, label: 'Every 12 weeks' },
  { value: 16, label: 'Every 16 weeks' },
  { value: 20, label: 'Every 20 weeks' },
  { value: 24, label: 'Every 24 weeks' },
];

// Track autoship results for confirmation screen
const [autoshipResults, setAutoshipResults] = useState<Array<{
  product_name: string;
  frequency: number;
  next_run_at: string;
  order_id: string;
}>>([]);

// Frequency picker state (which product's picker is open)
const [showFrequencyPicker, setShowFrequencyPicker] = useState<string | null>(null);
```

### 4.3 Add useEffect to Initialize Autoship Selections

After existing useEffects (around line 112):

```typescript
// Initialize autoship selections for eligible products
useEffect(() => {
  const selections: Record<string, { enabled: boolean; frequency: number }> = {};
  items.forEach(item => {
    if (item.product.autoship_eligible) {
      // Only initialize if not already set (preserve user choices)
      if (!(item.product_id in autoshipSelections)) {
        selections[item.product_id] = {
          enabled: false, // Default to one-time purchase
          frequency: 4, // Default to 4 weeks
        };
      }
    }
  });
  if (Object.keys(selections).length > 0) {
    setAutoshipSelections(prev => ({ ...prev, ...selections }));
  }
}, [items]);
```

### 4.4 Add Helper Functions

```typescript
// Calculate autoship savings for a product
const calculateAutoshipSavings = (basePrice: number): {
  autoshipPrice: number;
  savings: number;
  percentage: number;
} => {
  // Assuming 10% autoship discount (adjust based on your discount rules)
  const discountPercentage = 10;
  const savings = Math.round(basePrice * (discountPercentage / 100));
  const autoshipPrice = basePrice - savings;
  return {
    autoshipPrice,
    savings,
    percentage: discountPercentage,
  };
};

// Get total for today's order (including autoship items at discounted price)
const getTodaysOrderTotal = (): number => {
  return items.reduce((total, item) => {
    const selection = autoshipSelections[item.product_id];
    const isAutoship = item.product.autoship_eligible && selection?.enabled;

    if (isAutoship) {
      const { autoshipPrice } = calculateAutoshipSavings(item.product.base_price_idr);
      return total + (autoshipPrice * item.quantity);
    } else {
      return total + (item.product.base_price_idr * item.quantity);
    }
  }, 0);
};

// Get total savings from autoship selections
const getTotalAutoshipSavings = (): number => {
  return items.reduce((total, item) => {
    const selection = autoshipSelections[item.product_id];
    const isAutoship = item.product.autoship_eligible && selection?.enabled;

    if (isAutoship) {
      const { savings } = calculateAutoshipSavings(item.product.base_price_idr);
      return total + (savings * item.quantity);
    }
    return total;
  }, 0);
};

// Format date for display
const formatNextDeliveryDate = (frequencyWeeks: number): string => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + (frequencyWeeks * 7));
  return nextDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};
```

### 4.5 Update Cart Item Rendering

Replace the cart items section (around line 227-249) with:

```typescript
{items.map((item) => {
  const isAutoshipEligible = item.product.autoship_eligible ?? false;
  const selection = autoshipSelections[item.product_id];
  const isAutoship = isAutoshipEligible && selection?.enabled;
  const { autoshipPrice, savings, percentage } = calculateAutoshipSavings(item.product.base_price_idr);

  const displayPrice = isAutoship ? autoshipPrice : item.product.base_price_idr;
  const lineTotal = displayPrice * item.quantity;

  return (
    <View key={item.product_id} style={styles.cartItem}>
      {/* Product Image */}
      {item.product.primary_image_path && (
        <Image
          source={{ uri: getImageUrl(item.product.primary_image_path) }}
          style={styles.productImage}
          contentFit="cover"
        />
      )}

      <View style={styles.productInfo}>
        {/* Product Name */}
        <ThemedText type="defaultSemiBold" numberOfLines={2}>
          {item.product.name}
        </ThemedText>
        <ThemedText style={styles.quantityText}>Qty: {item.quantity}</ThemedText>

        {/* Autoship Toggle - Only for eligible products */}
        {isAutoshipEligible && (
          <View style={styles.autoshipSection}>
            {/* Subscribe & Save Toggle */}
            <TouchableOpacity
              style={styles.autoshipToggle}
              onPress={() => {
                setAutoshipSelections(prev => ({
                  ...prev,
                  [item.product_id]: {
                    enabled: !prev[item.product_id]?.enabled,
                    frequency: prev[item.product_id]?.frequency || 4,
                  }
                }));
              }}
            >
              <View style={[styles.checkbox, isAutoship && styles.checkboxChecked]}>
                {isAutoship && <MaterialIcons name="check" size={14} color="#fff" />}
              </View>
              <View style={styles.toggleTextContainer}>
                <ThemedText style={[styles.toggleLabel, isAutoship && styles.toggleLabelActive]}>
                  Subscribe & Save {percentage}%
                </ThemedText>
                {!isAutoship && (
                  <ThemedText style={styles.toggleHint}>
                    {formatPriceIDR(autoshipPrice)}/delivery
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>

            {/* Frequency Selector - Only when autoship is enabled */}
            {isAutoship && (
              <View style={styles.frequencyContainer}>
                <ThemedText style={styles.frequencyLabel}>Deliver:</ThemedText>

                {/* Dropdown Picker for frequency (Chewy-style with many options) */}
                <TouchableOpacity
                  style={styles.frequencyDropdown}
                  onPress={() => {
                    // Show picker modal or action sheet
                    // Implementation can use @react-native-picker/picker or a custom modal
                    setShowFrequencyPicker(item.product_id);
                  }}
                >
                  <ThemedText style={styles.frequencyDropdownText}>
                    {FREQUENCY_OPTIONS.find(opt => opt.value === selection.frequency)?.label || 'Every 4 weeks'}
                  </ThemedText>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>

                {/* Next delivery info */}
                <ThemedText style={styles.nextDeliveryText}>
                  Next delivery: {formatNextDeliveryDate(selection.frequency)}
                </ThemedText>
              </View>
            )}

            {/* Savings callout when enabled */}
            {isAutoship && (
              <View style={styles.savingsCallout}>
                <MaterialIcons name="local-offer" size={14} color="#4CAF50" />
                <ThemedText style={styles.savingsText}>
                  You save {formatPriceIDR(savings * item.quantity)} on this item
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Price Display */}
      <View style={styles.priceContainer}>
        {isAutoship && (
          <ThemedText style={styles.originalPrice}>
            {formatPriceIDR(item.product.base_price_idr * item.quantity)}
          </ThemedText>
        )}
        <ThemedText type="defaultSemiBold" style={isAutoship ? styles.autoshipPrice : undefined}>
          {formatPriceIDR(lineTotal)}
        </ThemedText>
        {isAutoship && (
          <View style={styles.autoshipBadge}>
            <ThemedText style={styles.autoshipBadgeText}>Autoship</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
})}
```

### 4.5.1 Add Frequency Picker Modal

Add this modal component after the cart items list (or at the end of the component before the return's closing tag):

```typescript
{/* Frequency Picker Modal */}
{showFrequencyPicker && (
  <Modal
    visible={true}
    transparent
    animationType="slide"
    onRequestClose={() => setShowFrequencyPicker(null)}
  >
    <Pressable
      style={styles.modalOverlay}
      onPress={() => setShowFrequencyPicker(null)}
    >
      <View style={styles.frequencyPickerContainer}>
        <View style={styles.frequencyPickerHeader}>
          <ThemedText type="subtitle">Delivery Frequency</ThemedText>
          <TouchableOpacity onPress={() => setShowFrequencyPicker(null)}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.frequencyPickerList}>
          {FREQUENCY_OPTIONS.map(option => {
            const isSelected = autoshipSelections[showFrequencyPicker]?.frequency === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.frequencyPickerOption,
                  isSelected && styles.frequencyPickerOptionSelected
                ]}
                onPress={() => {
                  setAutoshipSelections(prev => ({
                    ...prev,
                    [showFrequencyPicker]: {
                      ...prev[showFrequencyPicker],
                      frequency: option.value,
                    }
                  }));
                  setShowFrequencyPicker(null);
                }}
              >
                <ThemedText style={[
                  styles.frequencyPickerOptionText,
                  isSelected && styles.frequencyPickerOptionTextSelected
                ]}>
                  {option.label}
                </ThemedText>
                {isSelected && (
                  <MaterialIcons name="check" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Pressable>
  </Modal>
)}
```

**Add import for Modal:**
```typescript
import { Modal, Pressable, ScrollView } from 'react-native';
```

---

### 4.6 Update Order Summary Section

Replace the price summary section with:

```typescript
{/* Order Summary */}
<View style={styles.summaryCard}>
  <ThemedText type="subtitle" style={styles.summaryTitle}>Order Summary</ThemedText>

  {/* Today's Order */}
  <View style={styles.summarySection}>
    <View style={styles.summaryRow}>
      <ThemedText>Subtotal ({items.length} items)</ThemedText>
      <ThemedText>{formatPriceIDR(getTodaysOrderTotal())}</ThemedText>
    </View>

    {/* Show savings if any autoship selected */}
    {getTotalAutoshipSavings() > 0 && (
      <View style={styles.summaryRow}>
        <ThemedText style={styles.savingsLabel}>Autoship Savings</ThemedText>
        <ThemedText style={styles.savingsValue}>
          -{formatPriceIDR(getTotalAutoshipSavings())}
        </ThemedText>
      </View>
    )}

    <View style={styles.summaryRow}>
      <ThemedText>Shipping</ThemedText>
      <ThemedText style={styles.freeShipping}>FREE</ThemedText>
    </View>

    <View style={[styles.summaryRow, styles.totalRow]}>
      <ThemedText type="defaultSemiBold" style={styles.totalLabel}>
        Today's Total
      </ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.totalValue}>
        {formatPriceIDR(getTodaysOrderTotal())}
      </ThemedText>
    </View>
  </View>

  {/* Future Deliveries Summary */}
  {items.some(item => autoshipSelections[item.product_id]?.enabled) && (
    <View style={styles.futureDeliveriesSection}>
      <ThemedText type="subtitle" style={styles.futureDeliveriesTitle}>
        Your Subscriptions
      </ThemedText>
      {items
        .filter(item => autoshipSelections[item.product_id]?.enabled)
        .map(item => {
          const selection = autoshipSelections[item.product_id];
          const { autoshipPrice } = calculateAutoshipSavings(item.product.base_price_idr);
          return (
            <View key={item.product_id} style={styles.futureDeliveryItem}>
              <View style={styles.futureDeliveryInfo}>
                <ThemedText numberOfLines={1} style={styles.futureDeliveryName}>
                  {item.product.name}
                </ThemedText>
                <ThemedText style={styles.futureDeliverySchedule}>
                  Every {selection.frequency} weeks - {formatPriceIDR(autoshipPrice * item.quantity)}
                </ThemedText>
              </View>
              <ThemedText style={styles.futureDeliveryDate}>
                Next: {formatNextDeliveryDate(selection.frequency)}
              </ThemedText>
            </View>
          );
        })}
    </View>
  )}
</View>
```

### 4.7 Update handlePlaceOrder Function

Replace the entire `handlePlaceOrder` function:

```typescript
const handlePlaceOrder = async () => {
  if (!selectedAddressId || items.length === 0) {
    Alert.alert('Error', 'Please select a shipping address');
    return;
  }

  try {
    setPlacingOrder(true);

    // Separate items into autoship and one-time
    const autoshipItems: Array<{
      product_id: string;
      quantity: number;
      frequency: number;
      product_name: string;
    }> = [];
    const oneTimeItems: Array<{ product_id: string; quantity: number }> = [];

    items.forEach(item => {
      const selection = autoshipSelections[item.product_id];
      if (item.product.autoship_eligible && selection?.enabled) {
        autoshipItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          frequency: selection.frequency,
          product_name: item.product.name,
        });
      } else {
        oneTimeItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
        });
      }
    });

    const results = {
      autoshipOrders: [] as Array<{
        product_name: string;
        order_id: string;
        autoship_id: string;
        next_run_at: string;
        frequency: number;
      }>,
      autoshipErrors: [] as string[],
      oneTimeOrderCreated: false,
      oneTimeOrderId: null as string | null,
      oneTimeOrderError: null as string | null,
    };

    // Process autoship items - each creates subscription + immediate order
    for (const autoshipItem of autoshipItems) {
      try {
        const result = await createAutoshipWithOrder({
          productId: autoshipItem.product_id,
          quantity: autoshipItem.quantity,
          frequencyWeeks: autoshipItem.frequency,
          addressId: selectedAddressId,
        });

        if (result.success && result.order_id && result.autoship_id) {
          results.autoshipOrders.push({
            product_name: autoshipItem.product_name,
            order_id: result.order_id,
            autoship_id: result.autoship_id,
            next_run_at: result.next_run_at || '',
            frequency: autoshipItem.frequency,
          });
        } else {
          results.autoshipErrors.push(
            `${autoshipItem.product_name}: ${result.message || 'Failed to create subscription'}`
          );
        }
      } catch (error: any) {
        results.autoshipErrors.push(
          `${autoshipItem.product_name}: ${error.message || 'Error creating subscription'}`
        );
      }
    }

    // Process one-time items (if any)
    if (oneTimeItems.length > 0) {
      try {
        const orderResult = await createOrder(oneTimeItems, selectedAddressId);
        if (orderResult.success && orderResult.order_id) {
          results.oneTimeOrderCreated = true;
          results.oneTimeOrderId = orderResult.order_id;
        } else {
          results.oneTimeOrderError = orderResult.error || 'Failed to create order';
        }
      } catch (error: any) {
        results.oneTimeOrderError = error.message || 'Failed to create order';
      }
    }

    // Determine overall success
    const hasAutoshipSuccess = results.autoshipOrders.length > 0;
    const hasOneTimeSuccess = results.oneTimeOrderCreated || oneTimeItems.length === 0;
    const hasErrors = results.autoshipErrors.length > 0 || results.oneTimeOrderError;
    const hasAnySuccess = hasAutoshipSuccess || results.oneTimeOrderCreated;

    if (!hasAnySuccess) {
      // Complete failure
      const errorMessages = [
        ...results.autoshipErrors,
        ...(results.oneTimeOrderError ? [results.oneTimeOrderError] : []),
      ];
      Alert.alert('Checkout Failed', errorMessages.join('\n'));
    } else if (hasErrors) {
      // Partial success - show warning but proceed
      const errorMessages = [
        ...results.autoshipErrors,
        ...(results.oneTimeOrderError ? [results.oneTimeOrderError] : []),
      ];

      Alert.alert(
        'Partial Success',
        `Some items were processed successfully, but there were errors:\n\n${errorMessages.join('\n')}`,
        [{ text: 'Continue', onPress: () => proceedToConfirmation(results) }]
      );
    } else {
      // Complete success
      proceedToConfirmation(results);
    }
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to complete checkout');
  } finally {
    setPlacingOrder(false);
  }
};

const proceedToConfirmation = (results: {
  autoshipOrders: Array<{
    product_name: string;
    order_id: string;
    autoship_id: string;
    next_run_at: string;
    frequency: number;
  }>;
  oneTimeOrderCreated: boolean;
  oneTimeOrderId: string | null;
}) => {
  // Store autoship results for confirmation screen
  setAutoshipResults(results.autoshipOrders.map(order => ({
    product_name: order.product_name,
    frequency: order.frequency,
    next_run_at: order.next_run_at,
    order_id: order.order_id,
  })));

  // Set order ID (use first autoship order ID if no one-time order)
  const mainOrderId = results.oneTimeOrderId || results.autoshipOrders[0]?.order_id;
  if (mainOrderId) {
    setOrderId(mainOrderId);
  }

  // Clear cart and show confirmation
  clearCart();
  setStep('confirmation');
};
```

### 4.8 Update Confirmation Screen

Update the confirmation step to show both order and subscription info:

```typescript
{/* Confirmation Step */}
{step === 'confirmation' && (
  <ScrollView style={styles.confirmationContainer}>
    {/* Success Icon */}
    <View style={styles.confirmationHeader}>
      <View style={styles.successIcon}>
        <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
      </View>
      <ThemedText type="title" style={styles.confirmationTitle}>
        Order Placed!
      </ThemedText>
      <ThemedText style={styles.confirmationSubtitle}>
        Thank you for your order
      </ThemedText>
    </View>

    {/* Order Summary Card */}
    <View style={styles.confirmationCard}>
      <ThemedText type="subtitle">Order Details</ThemedText>
      {orderId && (
        <ThemedText style={styles.orderIdText}>
          Order #{orderId.slice(0, 8).toUpperCase()}
        </ThemedText>
      )}
      <ThemedText style={styles.confirmationNote}>
        You'll receive a confirmation email shortly.
      </ThemedText>
    </View>

    {/* Subscriptions Created */}
    {autoshipResults.length > 0 && (
      <View style={styles.confirmationCard}>
        <View style={styles.subscriptionHeader}>
          <MaterialIcons name="autorenew" size={24} color="#007AFF" />
          <ThemedText type="subtitle" style={styles.subscriptionTitle}>
            Subscriptions Created
          </ThemedText>
        </View>

        <ThemedText style={styles.subscriptionNote}>
          Your first delivery is on its way! Future deliveries are scheduled below:
        </ThemedText>

        {autoshipResults.map((result, index) => (
          <View key={index} style={styles.subscriptionItem}>
            <ThemedText style={styles.subscriptionProductName}>
              {result.product_name}
            </ThemedText>
            <View style={styles.subscriptionDetails}>
              <ThemedText style={styles.subscriptionFrequency}>
                Every {result.frequency} weeks
              </ThemedText>
              {result.next_run_at && (
                <ThemedText style={styles.subscriptionNextDate}>
                  Next delivery: {new Date(result.next_run_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </ThemedText>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.manageSubscriptionsButton}
          onPress={() => router.push('/(tabs)/orders')}
        >
          <ThemedText style={styles.manageSubscriptionsText}>
            Manage Subscriptions
          </ThemedText>
          <MaterialIcons name="chevron-right" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
    )}

    {/* Action Buttons */}
    <View style={styles.confirmationActions}>
      <TouchableOpacity
        style={styles.viewOrderButton}
        onPress={() => {
          if (orderId) {
            router.push(`/orders/${orderId}`);
          } else {
            router.push('/(tabs)/orders');
          }
        }}
      >
        <ThemedText style={styles.viewOrderButtonText}>View Order</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.continueShoppingButton}
        onPress={() => router.push('/(tabs)')}
      >
        <ThemedText style={styles.continueShoppingText}>Continue Shopping</ThemedText>
      </TouchableOpacity>
    </View>
  </ScrollView>
)}
```

### 4.9 Update Place Order Button Text

```typescript
<TouchableOpacity
  style={[styles.placeOrderButton, placingOrder && styles.placeOrderButtonDisabled]}
  onPress={handlePlaceOrder}
  disabled={placingOrder || !selectedAddressId}
>
  <ThemedText style={styles.placeOrderButtonText}>
    {placingOrder
      ? 'Processing...'
      : items.some(item => autoshipSelections[item.product_id]?.enabled)
        ? 'Place Order & Start Subscriptions'
        : 'Place Order'}
  </ThemedText>
</TouchableOpacity>
```

---

## Step 5: Add Styles

Add these styles to the StyleSheet at the end of the checkout file:

```typescript
const styles = StyleSheet.create({
  // ... existing styles ...

  // Autoship Section Styles
  autoshipSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  autoshipToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toggleLabelActive: {
    color: '#007AFF',
  },
  toggleHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Frequency Selector (Dropdown style for many options)
  frequencyContainer: {
    marginTop: 12,
    marginLeft: 32,
  },
  frequencyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  frequencyDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  frequencyDropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  nextDeliveryText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },

  // Frequency Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  frequencyPickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  frequencyPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  frequencyPickerList: {
    paddingHorizontal: 16,
    paddingBottom: 34, // Safe area for iOS
  },
  frequencyPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  frequencyPickerOptionSelected: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  frequencyPickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  frequencyPickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },

  // Savings Callout
  savingsCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 32,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },

  // Price Container
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 90,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  autoshipPrice: {
    color: '#007AFF',
  },
  autoshipBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  autoshipBadgeText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Summary Styles
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  summaryTitle: {
    marginBottom: 16,
  },
  summarySection: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
  },
  totalValue: {
    fontSize: 18,
    color: '#007AFF',
  },
  savingsLabel: {
    color: '#4CAF50',
  },
  savingsValue: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  freeShipping: {
    color: '#4CAF50',
    fontWeight: '500',
  },

  // Future Deliveries
  futureDeliveriesSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  futureDeliveriesTitle: {
    marginBottom: 12,
    color: '#007AFF',
  },
  futureDeliveryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  futureDeliveryInfo: {
    flex: 1,
  },
  futureDeliveryName: {
    fontSize: 13,
    fontWeight: '500',
  },
  futureDeliverySchedule: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  futureDeliveryDate: {
    fontSize: 11,
    color: '#007AFF',
  },

  // Confirmation Styles
  confirmationContainer: {
    flex: 1,
    padding: 20,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    marginBottom: 8,
  },
  confirmationSubtitle: {
    color: '#666',
  },
  confirmationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  orderIdText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  confirmationNote: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  subscriptionTitle: {
    color: '#007AFF',
  },
  subscriptionNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  subscriptionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subscriptionProductName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionDetails: {
    gap: 2,
  },
  subscriptionFrequency: {
    fontSize: 13,
    color: '#666',
  },
  subscriptionNextDate: {
    fontSize: 12,
    color: '#007AFF',
  },
  manageSubscriptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  manageSubscriptionsText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  confirmationActions: {
    gap: 12,
    marginTop: 8,
  },
  viewOrderButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewOrderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  continueShoppingButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueShoppingText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
```

---

## Testing Checklist

### Functional Tests
- [ ] Autoship toggle appears only for eligible products
- [ ] Toggle can be enabled/disabled
- [ ] Frequency dropdown appears when autoship enabled
- [ ] Frequency picker modal opens on dropdown tap
- [ ] All 13 frequency options display correctly (1-8, 10, 12, 16, 20, 24 weeks)
- [ ] Selected frequency shows checkmark in picker
- [ ] Frequency selection updates dropdown text
- [ ] Price updates to show autoship discount
- [ ] Original price shown with strikethrough
- [ ] Savings displayed correctly
- [ ] Order summary shows today's total correctly
- [ ] Future subscriptions section shows when autoship enabled
- [ ] Mixed cart works (some autoship, some one-time)
- [ ] All autoship checkout works
- [ ] All one-time checkout works
- [ ] Immediate order created with autoship pricing
- [ ] Autoship subscription created with correct next_run_at
- [ ] autoship_runs record created for immediate order
- [ ] Confirmation shows both order and subscription info

### Edge Cases
- [ ] Cart with only autoship items
- [ ] Cart with only one-time items
- [ ] Cart with mix of eligible and non-eligible products
- [ ] User toggles autoship on/off multiple times
- [ ] User changes frequency multiple times
- [ ] Product already has active autoship (should show error)
- [ ] Network error during autoship creation
- [ ] Network error during order creation
- [ ] Partial success (some items fail, some succeed)
- [ ] User has no addresses

### Data Integrity
- [ ] Order has source = 'autoship' for subscription items
- [ ] Order items have correct autoship pricing
- [ ] Autoship subscription has correct frequency_weeks
- [ ] Autoship next_run_at is checkout_date + frequency_weeks
- [ ] autoship_runs has record for immediate order
- [ ] autoship_runs status is 'completed'

---

## Implementation Order

1. **Database Migration** (`0026_autoship_with_order.sql`)
   - Create the atomic function
   - Run migration: `npx supabase db push`

2. **Mobile Data Layer** (`apps/mobile/lib/autoships.ts`)
   - Add `createAutoshipWithOrder()` function

3. **Cart Context** (`apps/mobile/contexts/CartContext.tsx`)
   - Add `autoship_eligible` to CartItem type
   - Update `addItem()` to fetch eligibility

4. **Checkout Screen** (`apps/mobile/app/checkout/index.tsx`)
   - Add state for autoship selections
   - Add autoship toggle UI
   - Add frequency selector
   - Update price calculations
   - Update order summary
   - Update handlePlaceOrder
   - Update confirmation screen
   - Add styles

5. **Testing**
   - Test all scenarios from checklist
   - Verify data integrity

---

## Rollback Plan

If issues arise:

1. **Quick disable**: Comment out autoship section in checkout UI
   ```typescript
   {/* {isAutoshipEligible && (...)} */}
   ```

2. **Full rollback**:
   - Checkout will work with one-time orders only
   - Product page enrollment still available as fallback

---

## Summary

This Chewy-style implementation:
- Places immediate first order when subscribing during checkout
- Applies autoship discount to the immediate order
- Creates subscription for future automatic deliveries
- Shows clear savings and next delivery date
- Handles mixed carts (autoship + one-time items)
- Maintains all existing product-page enrollment functionality

**Status**: Ready for Implementation
