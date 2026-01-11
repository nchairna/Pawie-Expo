# Autoship Implementation Guide (Chewy.com-Inspired)

**Version**: 1.0
**Last Updated**: 2026-01-07
**Phase**: 5
**Status**: Implementation Guide

---

## Table of Contents

1. [Overview](#overview)
2. [Chewy.com Autoship Analysis](#chewycom-autoship-analysis)
3. [Database Schema](#database-schema)
4. [Business Rules](#business-rules)
5. [User Flows](#user-flows)
6. [Implementation Steps](#implementation-steps)
7. [API Endpoints](#api-endpoints)
8. [Scheduled Jobs](#scheduled-jobs)
9. [Email Notifications](#email-notifications)
10. [Error Handling](#error-handling)
11. [Testing Strategy](#testing-strategy)

---

## Overview

Autoship is Pawie's subscription feature that allows customers to receive regular deliveries of pet products automatically. It's inspired by Chewy.com's highly successful autoship program, which accounts for ~70% of their revenue.

### Key Benefits

**For Customers**:
- Save 5-10% on every autoship order
- Never run out of essential pet supplies
- Flexible scheduling (skip, pause, cancel anytime)
- Free shipping on eligible orders
- Reminder emails before each shipment

**For Business**:
- Predictable recurring revenue
- Higher customer lifetime value
- Lower customer acquisition cost (retained customers)
- Better inventory planning
- Increased basket size (customers add more items to autoship)

### Success Metrics (Chewy.com Benchmarks)

- **Autoship Enrollment Rate**: 40-60% of first-time customers
- **Autoship Retention**: 80-85% after 6 months
- **Autoship Revenue**: 60-70% of total revenue
- **Average Items per Autoship**: 3-5 products
- **Churn Rate**: 10-15% annually

---

## Chewy.com Autoship Analysis

### How Chewy Does It

**Enrollment Flow**:
1. Every product shows autoship option on PDP (Product Detail Page)
2. Clear savings messaging: "Autoship & Save 10%"
3. One-click enrollment during checkout
4. Default frequency: 4 weeks (customizable)
5. No subscription fee

**Management**:
1. Dedicated "Autoship" section in account
2. Visual calendar showing next deliveries
3. Easy skip/pause/cancel
4. Change frequency or quantity
5. Add/remove products

**Execution**:
1. Email reminder 3-5 days before shipment
2. Automatic payment processing
3. Order created and shipped
4. Next delivery scheduled
5. Failure handling (retry payment, notify customer)

**Pricing**:
- Autoship discount: 5-10% (varies by product)
- Can stack with other promotions (sometimes)
- Price locked at enrollment (with cap on increases)
- Free shipping threshold: $49

### Key Differentiators

1. **Always Cheaper**: Autoship price always beats one-time purchase
2. **Complete Flexibility**: No commitment, cancel anytime
3. **Smart Reminders**: Email before each shipment with option to skip
4. **Easy Management**: Mobile app + web interface
5. **Transparent Pricing**: Show exact savings on every screen

---

## Database Schema

### Current Schema (Already Implemented)

```sql
-- Main autoship subscription table
CREATE TABLE autoships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity int NOT NULL CHECK (quantity > 0),
    frequency_weeks int NOT NULL CHECK (frequency_weeks > 0),
    next_run_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Execution log table
CREATE TABLE autoship_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    autoship_id uuid NOT NULL REFERENCES autoships(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    scheduled_at timestamptz NOT NULL,
    executed_at timestamptz,
    status text NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
    error_message text,
    created_at timestamptz DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_autoships_user ON autoships(user_id);
CREATE INDEX idx_autoships_next_run ON autoships(next_run_at) WHERE status = 'active';
CREATE INDEX idx_autoships_status ON autoships(status);
CREATE INDEX idx_autoship_runs_autoship ON autoship_runs(autoship_id);
CREATE INDEX idx_autoship_runs_scheduled ON autoship_runs(scheduled_at);
```

### Schema Issues to Fix

**Issue 1**: `product_variant_id` references deprecated table

```sql
-- CHANGE:
product_variant_id uuid NOT NULL REFERENCES product_variants(id)

-- TO:
product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT
```

**Issue 2**: Missing enrolled price snapshot

```sql
-- ADD COLUMN:
ALTER TABLE autoships ADD COLUMN enrolled_price_idr int NOT NULL;

-- Rationale: Lock in price at enrollment (prevents sticker shock)
-- Chewy caps price increases at 10% above enrolled price
```

**Issue 3**: Missing skip functionality

```sql
-- ADD COLUMNS:
ALTER TABLE autoships ADD COLUMN skip_next_delivery boolean DEFAULT false;
ALTER TABLE autoships ADD COLUMN last_skipped_at timestamptz;

-- When user clicks "Skip Next":
-- - Set skip_next_delivery = true
-- - On next run, advance next_run_at without creating order
-- - Set skip_next_delivery = false
```

**Issue 4**: Missing pause metadata

```sql
-- ADD COLUMNS:
ALTER TABLE autoships ADD COLUMN paused_at timestamptz;
ALTER TABLE autoships ADD COLUMN pause_reason text;

-- Track why users pause (survey or optional)
```

### Recommended Schema Enhancements

```sql
-- Migration: 0013_enhance_autoship.sql

-- 1. Add price locking
ALTER TABLE autoships ADD COLUMN enrolled_price_idr int NOT NULL;
ALTER TABLE autoships ADD COLUMN price_lock_cap_percent int DEFAULT 10 CHECK (price_lock_cap_percent >= 0);

-- 2. Add skip functionality
ALTER TABLE autoships ADD COLUMN skip_next_delivery boolean DEFAULT false;
ALTER TABLE autoships ADD COLUMN last_skipped_at timestamptz;

-- 3. Add pause metadata
ALTER TABLE autoships ADD COLUMN paused_at timestamptz;
ALTER TABLE autoships ADD COLUMN pause_reason text;

-- 4. Add reminder tracking
ALTER TABLE autoships ADD COLUMN last_reminder_sent_at timestamptz;
ALTER TABLE autoships ADD COLUMN reminder_days_before int DEFAULT 3 CHECK (reminder_days_before >= 0);

-- 5. Add enrollment source tracking
ALTER TABLE autoships ADD COLUMN enrollment_source text DEFAULT 'product_page'
    CHECK (enrollment_source IN ('product_page', 'checkout', 'account', 'reorder'));

-- 6. Fix product reference (BREAKING CHANGE)
-- Step 1: Add new column
ALTER TABLE autoships ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE RESTRICT;

-- Step 2: Migrate data (if any exists)
-- UPDATE autoships SET product_id = (SELECT product_id FROM product_variants WHERE id = autoships.product_variant_id);

-- Step 3: Make it NOT NULL
-- ALTER TABLE autoships ALTER COLUMN product_id SET NOT NULL;

-- Step 4: Drop old column (after verifying data)
-- ALTER TABLE autoships DROP COLUMN product_variant_id;

-- 7. Add autoship_runs enhancements
ALTER TABLE autoship_runs ADD COLUMN retry_count int DEFAULT 0;
ALTER TABLE autoship_runs ADD COLUMN payment_error_code text;
ALTER TABLE autoship_runs ADD COLUMN inventory_snapshot jsonb; -- Record what was available at execution time
ALTER TABLE autoship_runs ADD COLUMN price_at_execution_idr int; -- Record actual price charged

-- 8. Create composite index for scheduler
CREATE INDEX idx_autoships_scheduler ON autoships(status, next_run_at)
    WHERE status = 'active' AND skip_next_delivery = false;
```

---

## Business Rules

### Enrollment Rules

1. **Eligibility**:
   - Product must be eligible for autoship (flag on products table)
   - User must be authenticated
   - Minimum order value: None (Chewy has none)
   - Maximum quantity per autoship: 99

2. **Frequency Options**:
   - 1 week
   - 2 weeks (default for most products)
   - 3 weeks
   - 4 weeks
   - 6 weeks
   - 8 weeks
   - 12 weeks

3. **Price Locking**:
   - Lock price at enrollment: `enrolled_price_idr`
   - Allow price increases up to 10% above enrolled price
   - If base price increases >10%, notify customer and pause autoship
   - Customer can accept new price or cancel

4. **Discount Application**:
   - Autoship discount: 5-10% (configured per product or globally)
   - Applied automatically at enrollment and every execution
   - Can stack with other discounts (configurable via `stack_policy`)

### Execution Rules

1. **Scheduling**:
   - Run scheduler every hour (cron: `0 * * * *`)
   - Find autoships where `next_run_at <= NOW() AND status = 'active' AND skip_next_delivery = false`
   - Process in batches of 100

2. **Execution Flow**:
   ```
   For each due autoship:
   1. Check inventory availability
      - If out of stock: send notification, reschedule for +1 day (up to 7 days)
   2. Compute current price (apply autoship discount)
      - If price > enrolled_price * 1.10: pause and notify
   3. Attempt payment
      - If success: continue
      - If fail: retry up to 3 times over 3 days
   4. Create order (source = 'autoship')
   5. Decrement inventory
   6. Update next_run_at = next_run_at + frequency_weeks
   7. Create autoship_run record (status = 'success')
   8. Send confirmation email
   ```

3. **Failure Handling**:
   - **Payment Failed**: Retry 3 times (day 0, day 1, day 3)
   - **Inventory Out**: Reschedule for +1 day (up to 7 days), then pause
   - **Price Increased**: Pause autoship, notify customer
   - **Product Discontinued**: Cancel autoship, notify customer, offer alternatives

4. **Reminder Emails**:
   - Send 3 days before `next_run_at`
   - Include: products, quantity, price, next delivery date
   - CTA: "Skip this delivery" or "Edit autoship"
   - Track: `last_reminder_sent_at`

### Management Rules

1. **Skip Next Delivery**:
   - Set `skip_next_delivery = true`
   - On next execution: advance `next_run_at` without creating order
   - Reset `skip_next_delivery = false` after skipping

2. **Pause Autoship**:
   - Set `status = 'paused'`
   - Set `paused_at = NOW()`
   - Optionally collect `pause_reason`
   - Can resume anytime

3. **Cancel Autoship**:
   - Set `status = 'cancelled'`
   - Cannot be reactivated (user must create new autoship)
   - Keep record for analytics

4. **Change Frequency**:
   - Update `frequency_weeks`
   - Recalculate `next_run_at` based on last successful run

5. **Change Quantity**:
   - Update `quantity`
   - No impact on `next_run_at`

6. **Add/Remove Products**:
   - Each product is separate autoship
   - No "autoship basket" concept (keeps it simple)
   - Users can have multiple autoships

---

## User Flows

### 1. Enrollment from Product Page

```
Mobile App UI:
┌─────────────────────────────────────────────┐
│ Royal Canin Adult Dry Dog Food - Lamb 4lb  │
│ ★★★★☆ (1,234 reviews)                      │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ One-Time Purchase:  Rp 250,000      │   │
│ │                                      │   │
│ │ ○ Add to Cart                       │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Autoship & Save 10%: Rp 225,000     │   │
│ │                                      │   │
│ │ ● Autoship (Cancel Anytime)         │   │
│ │                                      │   │
│ │ Deliver every: [2 weeks ▼]          │   │
│ │ Quantity: [- 1 +]                   │   │
│ │                                      │   │
│ │ ✓ Save Rp 25,000 on every delivery  │   │
│ │ ✓ Free shipping on orders >Rp 300k  │   │
│ │ ✓ Skip, pause, or cancel anytime    │   │
│ │                                      │   │
│ │ [Enroll in Autoship]                │   │
│ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘

Flow:
1. User selects "Autoship" radio button
2. Choose frequency (default: 2 weeks)
3. Choose quantity (default: 1)
4. Click "Enroll in Autoship"
5. If not logged in: redirect to login/signup
6. Confirm enrollment modal:
   "Your first delivery will be on [date]"
   "You'll be charged Rp 225,000 today"
   "Next autoship: [date + frequency]"
7. Payment processing
8. Success: "Autoship enrolled! Check My Autoship to manage."
9. Email confirmation sent
```

### 2. Manage Autoship Dashboard

```
My Autoship Screen:
┌─────────────────────────────────────────────┐
│ My Autoship (3 Active)                      │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ [Image] Royal Canin Lamb 4lb        │   │
│ │                                      │   │
│ │ Every 2 weeks • Qty: 1              │   │
│ │ Next delivery: Jan 15, 2026         │   │
│ │ Price: Rp 225,000 (Save Rp 25,000)  │   │
│ │                                      │   │
│ │ [Skip Next] [Edit] [Cancel]         │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ [Image] Purina Pro Plan Chicken 8lb │   │
│ │                                      │   │
│ │ Every 4 weeks • Qty: 2              │   │
│ │ Next delivery: Jan 22, 2026         │   │
│ │ Price: Rp 760,000 (Save Rp 84,000)  │   │
│ │                                      │   │
│ │ [Skip Next] [Edit] [Cancel]         │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Upcoming Deliveries:                        │
│ Jan 15 - 1 item (Rp 225,000)               │
│ Jan 22 - 1 item (Rp 760,000)               │
└─────────────────────────────────────────────┘

Actions:
- Skip Next: Skips upcoming delivery, reschedules
- Edit: Change frequency or quantity
- Cancel: Cancels autoship (confirm modal)
```

### 3. Edit Autoship

```
Edit Autoship Modal:
┌─────────────────────────────────────────────┐
│ Edit Autoship                                │
│                                              │
│ Royal Canin Adult Dry Dog Food - Lamb 4lb   │
│                                              │
│ Frequency:                                   │
│ [Every 2 weeks ▼]                           │
│                                              │
│ Quantity:                                    │
│ [- 1 +]                                     │
│                                              │
│ Next Delivery:                               │
│ Jan 15, 2026                                │
│                                              │
│ [Cancel Autoship] [Save Changes]            │
└─────────────────────────────────────────────┘
```

### 4. Skip Next Delivery

```
Skip Confirmation Modal:
┌─────────────────────────────────────────────┐
│ Skip Next Delivery?                          │
│                                              │
│ Your next delivery (Jan 15, 2026) will be   │
│ skipped. Your following delivery will be:   │
│                                              │
│ Jan 29, 2026                                │
│                                              │
│ [Go Back] [Confirm Skip]                    │
└─────────────────────────────────────────────┘

On confirm:
- Set skip_next_delivery = true
- Show success toast: "Next delivery skipped"
- Update UI to show new next delivery date
```

---

## Implementation Steps

### Phase 5A: Database Schema Fixes

**Migration**: `0013_fix_autoship_schema.sql`

```sql
-- See "Recommended Schema Enhancements" above
```

**Tasks**:
1. Create migration file
2. Test locally with sample data
3. Apply to staging
4. Verify with sample autoships
5. Apply to production

### Phase 5B: Autoship Enrollment API

**Endpoint**: `POST /api/autoship/enroll`

**Request**:
```typescript
{
  product_id: string,      // UUID
  quantity: number,        // 1-99
  frequency_weeks: number, // 1, 2, 3, 4, 6, 8, 12
  start_date?: string,     // ISO date (optional, defaults to today)
}
```

**Response**:
```typescript
{
  autoship_id: string,
  product: {
    id: string,
    name: string,
    base_price_idr: number,
    autoship_price_idr: number, // After discount
    savings_idr: number,
  },
  quantity: number,
  frequency_weeks: number,
  next_run_at: string, // ISO date
  enrolled_price_idr: number,
}
```

**Implementation**:
```typescript
// supabase/functions/autoship-enroll/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Server-side only
  )

  // 1. Authenticate user
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError) return new Response('Unauthorized', { status: 401 })

  // 2. Parse request
  const { product_id, quantity, frequency_weeks, start_date } = await req.json()

  // 3. Validate product exists and is autoship-eligible
  const { data: product } = await supabase
    .from('products')
    .select('id, name, base_price_idr, autoship_eligible')
    .eq('id', product_id)
    .single()

  if (!product || !product.autoship_eligible) {
    return new Response('Product not eligible for autoship', { status: 400 })
  }

  // 4. Compute autoship price (apply discount)
  const { data: discount } = await supabase
    .from('discounts')
    .select('discount_value')
    .eq('kind', 'autoship')
    .eq('active', true)
    .single()

  const autoship_discount_percent = discount?.discount_value || 10
  const autoship_price_idr = Math.round(product.base_price_idr * (1 - autoship_discount_percent / 100))
  const savings_idr = product.base_price_idr - autoship_price_idr

  // 5. Calculate next_run_at
  const next_run_at = start_date
    ? new Date(start_date)
    : new Date() // Start immediately (will charge today)

  // 6. Create autoship record
  const { data: autoship, error } = await supabase
    .from('autoships')
    .insert({
      user_id: user.id,
      product_id,
      quantity,
      frequency_weeks,
      next_run_at: next_run_at.toISOString(),
      status: 'active',
      enrolled_price_idr: autoship_price_idr,
      enrollment_source: 'product_page',
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // 7. Process first payment (create order immediately)
  // TODO: Call create_order function with source='autoship'

  // 8. Send confirmation email
  // TODO: Call email service

  // 9. Return success
  return new Response(JSON.stringify({
    autoship_id: autoship.id,
    product: {
      id: product.id,
      name: product.name,
      base_price_idr: product.base_price_idr,
      autoship_price_idr,
      savings_idr,
    },
    quantity,
    frequency_weeks,
    next_run_at: autoship.next_run_at,
    enrolled_price_idr: autoship_price_idr,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Phase 5C: Autoship Management APIs

**Endpoints**:

1. `GET /api/autoship/list` - Get user's autoships
2. `PATCH /api/autoship/:id/skip` - Skip next delivery
3. `PATCH /api/autoship/:id/pause` - Pause autoship
4. `PATCH /api/autoship/:id/resume` - Resume paused autoship
5. `PATCH /api/autoship/:id/update` - Change frequency/quantity
6. `DELETE /api/autoship/:id/cancel` - Cancel autoship

**Example: Skip Next Delivery**:
```typescript
// PATCH /api/autoship/:id/skip
const { data, error } = await supabase
  .from('autoships')
  .update({
    skip_next_delivery: true,
    last_skipped_at: new Date().toISOString(),
  })
  .eq('id', autoship_id)
  .eq('user_id', user.id) // RLS enforcement
  .select()
  .single()
```

### Phase 5D: Autoship Scheduler (Cron Job)

**Deployment**: Supabase Edge Function + Cron Trigger

**Cron Schedule**: Every hour (`0 * * * *`)

**Implementation**:
```typescript
// supabase/functions/autoship-scheduler/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Find due autoships
  const { data: dueAutoships } = await supabase
    .from('autoships')
    .select(`
      *,
      product:products(*),
      user:profiles(*)
    `)
    .eq('status', 'active')
    .eq('skip_next_delivery', false)
    .lte('next_run_at', new Date().toISOString())
    .limit(100) // Process in batches

  console.log(`Found ${dueAutoships?.length || 0} due autoships`)

  // 2. Process each autoship
  for (const autoship of dueAutoships || []) {
    try {
      await processAutoship(supabase, autoship)
    } catch (error) {
      console.error(`Failed to process autoship ${autoship.id}:`, error)
      // Log failure but continue processing others
      await logAutoshipRun(supabase, autoship.id, 'failed', error.message)
    }
  }

  return new Response(JSON.stringify({
    processed: dueAutoships?.length || 0
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function processAutoship(supabase, autoship) {
  // 1. Check inventory
  const { data: inventory } = await supabase
    .from('inventory')
    .select('stock_quantity')
    .eq('product_id', autoship.product_id)
    .single()

  if (!inventory || inventory.stock_quantity < autoship.quantity) {
    // Out of stock: reschedule for tomorrow (up to 7 days)
    const retryCount = autoship.retry_count || 0
    if (retryCount < 7) {
      const tomorrow = new Date(autoship.next_run_at)
      tomorrow.setDate(tomorrow.getDate() + 1)

      await supabase
        .from('autoships')
        .update({
          next_run_at: tomorrow.toISOString(),
          retry_count: retryCount + 1,
        })
        .eq('id', autoship.id)

      // Send notification
      await sendEmail(autoship.user.email, 'autoship-delayed-out-of-stock', {
        product_name: autoship.product.name,
        retry_date: tomorrow.toISOString(),
      })
      return
    } else {
      // Max retries reached: pause autoship
      await supabase
        .from('autoships')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: 'Out of stock for 7+ days',
        })
        .eq('id', autoship.id)

      await sendEmail(autoship.user.email, 'autoship-paused-out-of-stock', {
        product_name: autoship.product.name,
      })
      return
    }
  }

  // 2. Compute current price
  const currentPrice = await computeAutoshipPrice(supabase, autoship.product_id)
  const maxAllowedPrice = autoship.enrolled_price_idr * 1.10

  if (currentPrice > maxAllowedPrice) {
    // Price increased too much: pause and notify
    await supabase
      .from('autoships')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        pause_reason: 'Price increased beyond limit',
      })
      .eq('id', autoship.id)

    await sendEmail(autoship.user.email, 'autoship-paused-price-increase', {
      product_name: autoship.product.name,
      old_price: autoship.enrolled_price_idr,
      new_price: currentPrice,
    })
    return
  }

  // 3. Create order (calls pricing engine + payment)
  const { data: order, error: orderError } = await supabase.rpc('create_autoship_order', {
    p_autoship_id: autoship.id,
    p_user_id: autoship.user_id,
    p_product_id: autoship.product_id,
    p_quantity: autoship.quantity,
  })

  if (orderError) {
    // Payment failed: retry logic
    const retryCount = autoship.payment_retry_count || 0
    if (retryCount < 3) {
      // Retry in 1 day
      const retryDate = new Date()
      retryDate.setDate(retryDate.getDate() + 1)

      await supabase
        .from('autoships')
        .update({
          next_run_at: retryDate.toISOString(),
          payment_retry_count: retryCount + 1,
        })
        .eq('id', autoship.id)

      await sendEmail(autoship.user.email, 'autoship-payment-failed-retry', {
        product_name: autoship.product.name,
        retry_date: retryDate.toISOString(),
        error_message: orderError.message,
      })

      await logAutoshipRun(supabase, autoship.id, 'failed', `Payment failed: ${orderError.message}`, null, retryCount)
      return
    } else {
      // Max retries: pause autoship
      await supabase
        .from('autoships')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: 'Payment failed after 3 retries',
        })
        .eq('id', autoship.id)

      await sendEmail(autoship.user.email, 'autoship-paused-payment-failed', {
        product_name: autoship.product.name,
      })

      await logAutoshipRun(supabase, autoship.id, 'failed', 'Payment failed after max retries')
      return
    }
  }

  // 4. Success! Update next_run_at
  const nextRun = new Date(autoship.next_run_at)
  nextRun.setDate(nextRun.getDate() + (autoship.frequency_weeks * 7))

  await supabase
    .from('autoships')
    .update({
      next_run_at: nextRun.toISOString(),
      payment_retry_count: 0, // Reset retry count
      retry_count: 0,
    })
    .eq('id', autoship.id)

  // 5. Log successful run
  await logAutoshipRun(supabase, autoship.id, 'success', null, order.id, 0, currentPrice)

  // 6. Send confirmation email
  await sendEmail(autoship.user.email, 'autoship-order-created', {
    product_name: autoship.product.name,
    quantity: autoship.quantity,
    price: currentPrice,
    order_id: order.id,
    next_delivery: nextRun.toISOString(),
  })
}

async function logAutoshipRun(supabase, autoship_id, status, error_message = null, order_id = null, retry_count = 0, price_at_execution_idr = null) {
  await supabase
    .from('autoship_runs')
    .insert({
      autoship_id,
      order_id,
      scheduled_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      status,
      error_message,
      retry_count,
      price_at_execution_idr,
    })
}

async function computeAutoshipPrice(supabase, product_id) {
  // Call pricing engine (see Pricing_Engine.md)
  // Apply autoship discount
  // Return final price
}

async function sendEmail(to, template, data) {
  // Call email service (Resend, SendGrid, etc.)
}
```

**Deployment**:
```bash
# Deploy Edge Function
npx supabase functions deploy autoship-scheduler

# Set up cron trigger (Supabase Dashboard)
# Cron: 0 * * * * (every hour)
# Function: autoship-scheduler
```

### Phase 5E: Email Reminders

**Cron Job**: Separate function that runs daily

**Logic**:
1. Find autoships where `next_run_at - 3 days <= NOW()`
2. Check if reminder already sent: `last_reminder_sent_at`
3. Send reminder email
4. Update `last_reminder_sent_at`

**Email Template**: "Your Autoship Delivery is Coming Soon"
- Product name, image
- Quantity, price
- Delivery date
- CTA: "Skip this delivery" (deep link to app)
- CTA: "Manage autoship" (deep link to account)

### Phase 5F: Mobile UI Implementation

**Screens to Build**:

1. **Product Detail Page**: Add autoship enrollment option
2. **My Autoship Screen**: List all active/paused autoships
3. **Edit Autoship Modal**: Change frequency/quantity
4. **Skip Confirmation Modal**: Confirm skip action
5. **Cancel Confirmation Modal**: Confirm cancel action

**Navigation**:
```
App Tabs:
- Shop
- Orders
- Autoship  <-- NEW TAB
- Pets
- Account
```

---

## API Endpoints

### Summary

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/autoship/enroll` | POST | Enroll in autoship | Required |
| `/api/autoship/list` | GET | Get user's autoships | Required |
| `/api/autoship/:id` | GET | Get single autoship | Required |
| `/api/autoship/:id/skip` | PATCH | Skip next delivery | Required |
| `/api/autoship/:id/pause` | PATCH | Pause autoship | Required |
| `/api/autoship/:id/resume` | PATCH | Resume autoship | Required |
| `/api/autoship/:id/update` | PATCH | Update frequency/quantity | Required |
| `/api/autoship/:id/cancel` | DELETE | Cancel autoship | Required |
| `/api/autoship/scheduler` | POST | Run scheduler (cron only) | Service Role |
| `/api/autoship/send-reminders` | POST | Send reminders (cron only) | Service Role |

---

## Scheduled Jobs

### 1. Autoship Execution Scheduler

**Function**: `autoship-scheduler`
**Trigger**: Cron (`0 * * * *` - every hour)
**Purpose**: Process due autoships

**Logic**: See Phase 5D implementation above

### 2. Reminder Email Sender

**Function**: `autoship-send-reminders`
**Trigger**: Cron (`0 9 * * *` - daily at 9 AM)
**Purpose**: Send 3-day reminder emails

**Implementation**:
```typescript
serve(async (req) => {
  const supabase = createClient(...)

  // Find autoships due in 3 days that haven't been reminded
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  threeDaysFromNow.setHours(0, 0, 0, 0) // Start of day

  const threeDaysFromNowEnd = new Date(threeDaysFromNow)
  threeDaysFromNowEnd.setHours(23, 59, 59, 999) // End of day

  const { data: autoships } = await supabase
    .from('autoships')
    .select(`
      *,
      product:products(*),
      user:profiles(*)
    `)
    .eq('status', 'active')
    .eq('skip_next_delivery', false)
    .gte('next_run_at', threeDaysFromNow.toISOString())
    .lte('next_run_at', threeDaysFromNowEnd.toISOString())
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysFromNow.toISOString()}`)

  for (const autoship of autoships || []) {
    await sendEmail(autoship.user.email, 'autoship-reminder', {
      product_name: autoship.product.name,
      product_image: autoship.product.primary_image_path,
      quantity: autoship.quantity,
      price: autoship.enrolled_price_idr,
      delivery_date: autoship.next_run_at,
      skip_link: `pawie://autoship/${autoship.id}/skip`,
      manage_link: `pawie://autoship`,
    })

    await supabase
      .from('autoships')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq('id', autoship.id)
  }

  return new Response(JSON.stringify({ sent: autoships?.length || 0 }))
})
```

---

## Email Notifications

### Email Templates Needed

1. **Autoship Enrolled**
   - Subject: "You're all set! Autoship enrolled for [Product]"
   - Content: Confirmation, first delivery date, savings amount

2. **Autoship Reminder** (3 days before)
   - Subject: "Your [Product] autoship delivers in 3 days"
   - Content: Product, quantity, price, delivery date, skip/manage CTAs

3. **Autoship Order Created**
   - Subject: "Your autoship order is on the way!"
   - Content: Order details, tracking (when available), next delivery date

4. **Autoship Payment Failed**
   - Subject: "Action needed: Update your payment method"
   - Content: Failed payment, retry date, update payment CTA

5. **Autoship Paused - Out of Stock**
   - Subject: "[Product] is out of stock - autoship paused"
   - Content: Explanation, restock notification opt-in

6. **Autoship Paused - Price Increase**
   - Subject: "Price update for your [Product] autoship"
   - Content: Old vs new price, accept/cancel CTAs

7. **Autoship Cancelled**
   - Subject: "Your [Product] autoship has been cancelled"
   - Content: Confirmation, re-enroll CTA

### Email Service Integration

**Recommended**: Resend (https://resend.com)

**Why Resend**:
- Clean API
- React email templates (type-safe)
- Good deliverability
- Free tier: 3,000 emails/month

**Setup**:
```typescript
import { Resend } from 'resend'
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

await resend.emails.send({
  from: 'Pawie <autoship@pawie.id>',
  to: user.email,
  subject: 'Your autoship reminder',
  html: renderEmailTemplate('autoship-reminder', data),
})
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution | User Impact |
|-------|-------|----------|-------------|
| Payment Declined | Insufficient funds, expired card | Retry 3x over 3 days, email user | Delay delivery |
| Out of Stock | Inventory depleted | Reschedule +1 day (7x), then pause | Delay or pause |
| Price Increased >10% | Base price changed | Pause autoship, notify user | Paused until accepted |
| Product Discontinued | Admin marked inactive | Cancel autoship, offer alternatives | Cancelled |
| Invalid Address | User moved | Pause autoship, request update | Paused until fixed |

### Retry Logic

**Payment Failures**:
- Retry 1: Same day (immediate)
- Retry 2: +1 day
- Retry 3: +2 days (day 3 total)
- After 3 failures: Pause autoship

**Inventory Shortages**:
- Retry 1-7: +1 day each
- After 7 days: Pause autoship

**System Errors** (500s):
- Retry 3x with exponential backoff (1min, 5min, 15min)
- After 3 failures: Log error, notify team

---

## Testing Strategy

### Unit Tests

```typescript
// Test: computeAutoshipPrice
describe('computeAutoshipPrice', () => {
  it('applies 10% autoship discount', async () => {
    const price = await computeAutoshipPrice(supabase, 'product-id')
    expect(price).toBe(225000) // 250000 - 10%
  })

  it('respects price lock cap', async () => {
    const autoship = { enrolled_price_idr: 225000 }
    const newPrice = 250000 // 11% increase
    const allowed = isPriceAllowed(autoship, newPrice)
    expect(allowed).toBe(false)
  })
})

// Test: processAutoship
describe('processAutoship', () => {
  it('creates order on success', async () => {
    const autoship = createMockAutoship()
    await processAutoship(supabase, autoship)

    const order = await getLatestOrder(autoship.user_id)
    expect(order.source).toBe('autoship')
  })

  it('reschedules on out of stock', async () => {
    const autoship = createMockAutoship()
    await setInventory(autoship.product_id, 0) // Out of stock

    await processAutoship(supabase, autoship)

    const updated = await getAutoship(autoship.id)
    expect(updated.next_run_at).toBeAfter(autoship.next_run_at)
  })
})
```

### Integration Tests

```typescript
// Test: Full autoship enrollment flow
it('enrolls user in autoship and creates first order', async () => {
  const user = await createTestUser()
  const product = await createTestProduct({ autoship_eligible: true })

  const response = await fetch('/api/autoship/enroll', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${user.token}` },
    body: JSON.stringify({
      product_id: product.id,
      quantity: 1,
      frequency_weeks: 2,
    }),
  })

  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.autoship_id).toBeDefined()

  // Verify order created
  const orders = await getOrders(user.id)
  expect(orders).toHaveLength(1)
  expect(orders[0].source).toBe('autoship')
})
```

### End-to-End Tests (Playwright)

```typescript
test('user can enroll in autoship from product page', async ({ page }) => {
  await page.goto('/products/royal-canin-lamb-4lb')

  // Select autoship option
  await page.click('[data-testid="autoship-radio"]')
  await page.selectOption('[data-testid="frequency-select"]', '2')

  // Enroll
  await page.click('[data-testid="enroll-autoship-btn"]')

  // Verify confirmation
  await expect(page.locator('[data-testid="autoship-success"]')).toBeVisible()

  // Navigate to My Autoship
  await page.click('[data-testid="my-autoship-tab"]')

  // Verify autoship listed
  await expect(page.locator('[data-testid="autoship-item"]')).toContainText('Royal Canin')
})
```

### Manual Testing Checklist

- [ ] Enroll in autoship from product page
- [ ] Enroll during checkout
- [ ] View My Autoship dashboard
- [ ] Skip next delivery
- [ ] Pause autoship
- [ ] Resume paused autoship
- [ ] Change frequency
- [ ] Change quantity
- [ ] Cancel autoship
- [ ] Receive reminder email 3 days before
- [ ] Receive order confirmation email
- [ ] Receive payment failure email
- [ ] Receive out-of-stock email
- [ ] Verify price lock (simulate price increase)
- [ ] Verify scheduler runs (check logs)

---

## Success Metrics

Track these KPIs to measure autoship success:

### Enrollment Metrics

- **Autoship Enrollment Rate**: % of customers who enroll
  - Target: 40-60% (Chewy benchmark)
- **Enrollment Source**: Product page vs checkout vs reorder
- **Time to First Enrollment**: Days from signup to first autoship

### Retention Metrics

- **Autoship Retention Rate**: % active after 1, 3, 6 months
  - Target: 85% after 6 months
- **Churn Rate**: % cancelled per month
  - Target: <3% monthly
- **Pause Rate**: % paused vs cancelled
- **Resume Rate**: % of paused autoships resumed

### Revenue Metrics

- **Autoship Revenue %**: % of total revenue from autoship
  - Target: 60-70% (Chewy benchmark)
- **Average Autoship Value**: Mean order value
- **Autoship LTV**: Customer lifetime value (autoship customers)
- **Autoship Frequency**: Average weeks between deliveries

### Operational Metrics

- **Execution Success Rate**: % of autoships processed successfully
  - Target: >95%
- **Payment Failure Rate**: % failed due to payment
  - Target: <5%
- **Inventory Failure Rate**: % failed due to out of stock
  - Target: <2%
- **Reminder Open Rate**: Email reminder open rate
  - Target: 40-50%

### Database Queries for Metrics

```sql
-- Enrollment rate (last 30 days)
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE autoship_enrolled) * 100.0 /
  COUNT(DISTINCT user_id) as enrollment_rate_percent
FROM (
  SELECT DISTINCT o.user_id,
    EXISTS(SELECT 1 FROM autoships WHERE user_id = o.user_id) as autoship_enrolled
  FROM orders o
  WHERE o.created_at >= NOW() - INTERVAL '30 days'
) subq;

-- Autoship revenue % (last 30 days)
SELECT
  SUM(total_price_idr) FILTER (WHERE source = 'autoship') * 100.0 /
  SUM(total_price_idr) as autoship_revenue_percent
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Execution success rate (last 30 days)
SELECT
  COUNT(*) FILTER (WHERE status = 'success') * 100.0 /
  COUNT(*) as success_rate_percent
FROM autoship_runs
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Churn rate (monthly)
SELECT
  COUNT(*) FILTER (WHERE status = 'cancelled' AND
    DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())) * 100.0 /
  COUNT(*) FILTER (WHERE created_at < DATE_TRUNC('month', NOW()))
  as monthly_churn_rate_percent
FROM autoships;
```

---

## Future Enhancements

### Phase 6+

1. **Autoship Bundles**
   - Allow multiple products in one autoship
   - Coordinated delivery dates
   - Bundle discounts

2. **Smart Frequency Recommendations**
   - ML-based frequency suggestions
   - Based on pet size, product type, consumption patterns
   - "Customers with a 15lb dog typically reorder every 3 weeks"

3. **Autoship Gifting**
   - Send autoship as gift to friend
   - Gift card for autoship enrollment

4. **Autoship Analytics Dashboard**
   - User-facing analytics: "You've saved Rp 500,000 with autoship!"
   - Consumption tracking: "You're using more/less than expected"

5. **Autoship Rewards**
   - Loyalty points for autoship customers
   - Free gifts after X deliveries
   - Referral bonuses

6. **Flexible Autoship**
   - Alternate between products (e.g., chicken flavor one month, lamb the next)
   - Seasonal adjustments (more in winter, less in summer)

---

## Appendix

### Chewy.com Autoship References

- Chewy Autoship FAQ: https://www.chewy.com/app/content/autoship
- Chewy Autoship Benefits: https://www.chewy.com/autoship-benefits
- Investor Presentations (mention 70% autoship revenue)

### Code Samples Repository

All code samples from this guide are available at:
`/examples/autoship/`

---

**Document Status**: ✅ Complete
**Implementation Status**: ⏳ Not Started (Phase 5)
**Next Steps**: Review with team, create implementation tasks
