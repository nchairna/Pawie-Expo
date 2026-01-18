# Phase 5 — Autoship System

**Product**: Pawie
**Phase**: 5
**Status**: ✅ Complete - Ready for Testing & Deployment
**Last Updated**: 2026-01-17
**Estimated Duration**: 3 weeks
**Progress**: ~99%

---

## Current Implementation Status

### ✅ Completed:
- [x] **Part A: Backend Functions** - `supabase/migrations/0025_autoship_functions.sql` ✅ **MIGRATED**
  - All 8 functions created and deployed (create, update, pause, resume, cancel, skip, execute, run_due)
  - Idempotency implemented via autoship_runs deduplication
  - Helper function `get_user_default_address()` added
  - Performance indexes added
  - **Migration Status**: ✅ Applied to database

- [x] **Part B: Admin App** ✅
  - `apps/admin/lib/types.ts` - Autoship types added
  - `apps/admin/lib/autoships.ts` - Data access layer complete
  - `apps/admin/app/autoships/page.tsx` - List page with tabs/filters
  - `apps/admin/app/autoships/[id]/page.tsx` - Detail page
  - `apps/admin/app/autoships/[id]/autoship-actions.tsx` - Action buttons
  - Sidebar navigation updated

- [x] **Part C: Mobile App** ✅
  - `apps/mobile/lib/types.ts` - Autoship types added ✅
  - `apps/mobile/lib/autoships.ts` - Data access layer complete ✅
  - `apps/mobile/app/(tabs)/orders.tsx` - Updated with Order History / Autoships tabs ✅
  - `apps/mobile/app/autoships/[id].tsx` - Autoship detail/management screen ✅
  - `apps/mobile/app/_layout.tsx` - Route added for autoships ✅
  - `apps/mobile/app/product/[id].tsx` - Subscribe & Save enrollment modal ✅

- [x] **Part D: Chewy-Style Autoship Enrollment During Checkout** ✅
  - `supabase/migrations/0026_autoship_with_order.sql` - Backend function for immediate order + subscription ✅
  - `apps/mobile/contexts/CartContext.tsx` - Added autoship_eligible field ✅
  - `apps/mobile/lib/autoships.ts` - createAutoshipWithOrder() function ✅
  - `apps/mobile/app/checkout/index.tsx` - Full Chewy-style enrollment UI ✅
  - Subscribe & Save toggle per eligible item
  - 13 frequency options (1-8, 10, 12, 16, 20, 24 weeks)
  - Immediate first order with autoship discount
  - Subscription created for future deliveries
  - Mixed cart support (autoship + one-time items)

### 🔄 Remaining:
- [ ] **Testing & Validation** (Part D)
  - Backend function tests
  - Idempotency verification
  - End-to-end flow testing
- [ ] **Scheduler Setup** - Configure `run_due_autoships()` cron job

---

## 1. Goal

Implement the Autoship (subscription) system where customers can:
- Enroll products for automatic recurring delivery
- Choose delivery frequency (weekly intervals)
- Receive autoship discounts automatically
- Manage their subscriptions (skip, pause, cancel)
- View autoship order history

Admin can:
- View all autoship subscriptions
- Monitor autoship execution
- Manually control autoships (pause, cancel)
- View demand forecasting data

**Key Principle**: Autoship execution must be idempotent - running the same scheduled delivery twice must not create duplicate orders.

---

## 2. Canonical References

This phase MUST align with:
- **Doc 03** — Data Model (autoships, autoship_runs schema)
- **Doc 04** — API & Data Flow (autoship execution flow)
- **Doc 07** — Overall Plan (Phase 5 requirements)

**Conflict Resolution**: If code conflicts with these docs, documentation takes precedence.

---

## 3. Prerequisites

Before starting Phase 5, ensure:
- [x] Phase 4 is 100% complete (orders & checkout working)
- [x] `create_order_with_inventory()` function working
- [x] Inventory management working
- [x] `autoships` table exists with RLS
- [x] `autoship_runs` table exists with RLS
- [x] Autoship discounts exist (kind = 'autoship')
- [x] Mobile and admin auth working

---

## 4. Existing Database Schema

**Table: `autoships`** (already exists)
```sql
CREATE TABLE public.autoships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    pet_id uuid REFERENCES public.pets(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    quantity integer NOT NULL,
    frequency_weeks integer NOT NULL,
    next_run_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Table: `autoship_runs`** (already exists)
```sql
CREATE TABLE public.autoship_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    autoship_id uuid NOT NULL REFERENCES public.autoships(id),
    scheduled_at timestamptz NOT NULL,
    executed_at timestamptz,
    status text NOT NULL,
    order_id uuid REFERENCES public.orders(id),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**Autoship Status Values**:
- `active` - Autoship is running, will execute on next_run_at
- `paused` - Temporarily paused, will not execute until resumed
- `cancelled` - Permanently cancelled
- `completed` - All deliveries completed (if finite)

**Autoship Run Status Values**:
- `pending` - Scheduled but not yet executed
- `completed` - Successfully created order
- `failed` - Execution failed (see error_message)
- `skipped` - User skipped this delivery

---

## 5. Scope

### Included in Phase 5:

**Backend**:
- [x] `create_autoship()` function - Create new autoship subscription ✅
- [x] `update_autoship()` function - Update autoship settings ✅
- [x] `pause_autoship()` function - Pause autoship ✅
- [x] `resume_autoship()` function - Resume paused autoship ✅
- [x] `cancel_autoship()` function - Cancel autoship ✅
- [x] `skip_next_autoship()` function - Skip next delivery ✅
- [x] `execute_autoship()` function - Execute a single autoship (creates order) ✅
- [x] `run_due_autoships()` function - Find and execute all due autoships ✅
- [x] Idempotency checks via autoship_runs ✅
- [x] Next run date calculation ✅
- [ ] Autoship RLS policies verification (pending testing)

**Admin App**:
- [x] Autoship list page (`/autoships`) with filtering ✅
- [x] Autoship detail page (`/autoships/[id]`) ✅
- [x] Autoship execution history ✅
- [x] Manual pause/resume/cancel controls ✅
- [x] Execution logs and error monitoring ✅
- [ ] Dashboard autoship statistics (optional, not critical)

**Mobile App**:
- [x] Autoship enrollment from product detail page ✅
- [ ] Autoship enrollment during checkout ⚠️ **NOT IMPLEMENTED** (see "How to Checkout with Autoship" below)
- [x] My Autoships screen (list all subscriptions) ✅
- [x] Autoship detail/management screen ✅
- [x] Skip next delivery button ✅
- [x] Change frequency ✅
- [x] Pause/resume autoship ✅
- [x] Cancel autoship with confirmation ✅
- [x] Autoship order history (filtered by source) ✅

### Excluded (Future Phases):
- Email notifications (Phase 6+)
- Autoship demand forecasting reports
- Shipping carrier integration
- Multiple products per autoship (bundles)

---

## 6. Implementation Plan

### Part A: Backend Autoship Functions (Week 1, Days 1-3)

#### A.1 Create Autoship Function

**File**: `supabase/migrations/0025_autoship_functions.sql`

**Function**: `create_autoship()`

**Signature**:
```sql
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
-- Returns:
-- {
--   "success": true,
--   "autoship_id": "uuid",
--   "next_run_at": "2026-01-24T00:00:00Z",
--   "product_name": "Product Name",
--   "quantity": 2,
--   "frequency_weeks": 4
-- }
$$;
```

**Logic**:
1. Validate user is authenticated
2. Validate product exists, is published, and autoship_eligible = true
3. Validate quantity > 0
4. Validate frequency_weeks in allowed range (1-8, 10, 12, 16, 20, 24 weeks)
5. Calculate next_run_at (start_date or now + frequency)
6. Insert autoship record
7. Return confirmation

**Validation Rules**:
- Product must have `autoship_eligible = true`
- User cannot have duplicate active autoship for same product
- Frequency must be one of: 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24 weeks (Chewy-style options)

**Testing Checklist**:
- [ ] Creates autoship with correct data
- [ ] Calculates next_run_at correctly
- [ ] Rejects non-autoship-eligible products
- [ ] Rejects invalid frequency
- [ ] Rejects duplicate autoship for same product

---

#### A.2 Update Autoship Function

**Function**: `update_autoship()`

**Signature**:
```sql
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
-- Returns:
-- {
--   "success": true,
--   "autoship_id": "uuid",
--   "updated_fields": ["quantity", "frequency_weeks"],
--   "new_next_run_at": "2026-02-07T00:00:00Z"
-- }
$$;
```

**Logic**:
1. Validate autoship exists and belongs to user
2. Validate autoship is active or paused (not cancelled)
3. Update provided fields
4. If frequency changed, recalculate next_run_at
5. Update updated_at timestamp
6. Return confirmation

**Testing Checklist**:
- [ ] Updates quantity correctly
- [ ] Updates frequency and recalculates next_run
- [ ] Rejects updates to cancelled autoships
- [ ] Only owner can update (RLS enforced)

---

#### A.3 Pause/Resume Autoship Functions

**Function**: `pause_autoship()`

```sql
CREATE OR REPLACE FUNCTION public.pause_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Pauses an active autoship
-- Returns: { "success": true, "autoship_id": "uuid", "status": "paused" }
$$;
```

**Function**: `resume_autoship()`

```sql
CREATE OR REPLACE FUNCTION public.resume_autoship(
  p_autoship_id uuid,
  p_next_run_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Resumes a paused autoship
-- If p_next_run_at not provided, calculates based on frequency from now
-- Returns: { "success": true, "autoship_id": "uuid", "status": "active", "next_run_at": "..." }
$$;
```

**Testing Checklist**:
- [ ] Pause changes status from active to paused
- [ ] Resume changes status from paused to active
- [ ] Resume calculates new next_run_at if not provided
- [ ] Cannot pause already paused autoship
- [ ] Cannot resume cancelled autoship

---

#### A.4 Cancel Autoship Function

**Function**: `cancel_autoship()`

```sql
CREATE OR REPLACE FUNCTION public.cancel_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Permanently cancels an autoship
-- Returns: { "success": true, "autoship_id": "uuid", "status": "cancelled" }
$$;
```

**Logic**:
1. Validate autoship exists and belongs to user
2. Validate autoship is not already cancelled
3. Update status to 'cancelled'
4. Update updated_at
5. Return confirmation

**Testing Checklist**:
- [ ] Cancels active autoship
- [ ] Cancels paused autoship
- [ ] Cannot cancel already cancelled autoship
- [ ] Cancelled autoships cannot be resumed

---

#### A.5 Skip Next Delivery Function

**Function**: `skip_next_autoship()`

```sql
CREATE OR REPLACE FUNCTION public.skip_next_autoship(
  p_autoship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Skips the next scheduled delivery
-- Creates autoship_run with status 'skipped'
-- Advances next_run_at by frequency_weeks
-- Returns: {
--   "success": true,
--   "autoship_id": "uuid",
--   "skipped_date": "2026-01-24T00:00:00Z",
--   "new_next_run_at": "2026-02-21T00:00:00Z"
-- }
$$;
```

**Logic**:
1. Validate autoship exists and belongs to user
2. Validate autoship is active
3. Create autoship_run record with status = 'skipped'
4. Advance next_run_at by frequency_weeks
5. Return confirmation

**Testing Checklist**:
- [ ] Creates skipped run record
- [ ] Advances next_run_at correctly
- [ ] Cannot skip paused/cancelled autoship
- [ ] Only owner can skip

---

#### A.6 Execute Autoship Function (Core)

**Function**: `execute_autoship()`

```sql
CREATE OR REPLACE FUNCTION public.execute_autoship(
  p_autoship_id uuid,
  p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Executes a single autoship - creates order with autoship pricing
--
-- Idempotency: Checks if autoship_run already exists for this scheduled_at
-- If already executed, returns existing result
--
-- Returns on success:
-- {
--   "success": true,
--   "autoship_id": "uuid",
--   "order_id": "uuid",
--   "run_id": "uuid",
--   "already_executed": false
-- }
--
-- Returns on failure:
-- {
--   "success": false,
--   "error": "INSUFFICIENT_INVENTORY" | "PRODUCT_NOT_AVAILABLE" | ...,
--   "run_id": "uuid"
-- }
$$;
```

**Logic** (CRITICAL - must be idempotent):
1. Check if autoship_run exists for this autoship_id + scheduled_at
   - If exists and status = 'completed': Return existing result (idempotent)
   - If exists and status = 'failed': Re-attempt execution
   - If exists and status = 'skipped': Return skipped status
2. Create or update autoship_run record with status = 'pending'
3. Call `create_order_with_inventory()` with:
   - user_id from autoship
   - items: [{ product_id, quantity from autoship }]
   - address_id: user's default address or most recent
   - source: 'autoship'
4. If order created successfully:
   - Update autoship_run: status = 'completed', order_id, executed_at
   - Update autoship: next_run_at = current + frequency_weeks
   - Return success
5. If order failed:
   - Update autoship_run: status = 'failed', error_message, executed_at
   - Return failure (don't advance next_run_at)

**Idempotency Key**: `(autoship_id, DATE_TRUNC('day', scheduled_at))`

**Testing Checklist**:
- [ ] Creates order with autoship source
- [ ] Applies autoship discounts
- [ ] Creates autoship_run record
- [ ] Advances next_run_at on success
- [ ] Does NOT advance next_run_at on failure
- [ ] Idempotent - same execution returns same result
- [ ] Records error message on failure

---

#### A.7 Run Due Autoships Function

**Function**: `run_due_autoships()`

```sql
CREATE OR REPLACE FUNCTION public.run_due_autoships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Finds all autoships where next_run_at <= now() and status = 'active'
-- Executes each one
-- Returns summary:
-- {
--   "total_due": 10,
--   "executed": 8,
--   "failed": 2,
--   "results": [...]
-- }
$$;
```

**Logic**:
1. Select all autoships WHERE next_run_at <= NOW() AND status = 'active'
2. For each autoship, call `execute_autoship(autoship_id, next_run_at)`
3. Collect results
4. Return summary

**Scheduling**: This function should be called by a cron job (Supabase pg_cron or external scheduler)

**Testing Checklist**:
- [ ] Finds all due autoships
- [ ] Executes each one
- [ ] Handles failures gracefully (continues to next)
- [ ] Returns accurate summary

---

### Part B: Admin Autoship Management (Week 1, Days 4-5)

#### B.1 Data Access Layer

**File**: `apps/admin/lib/autoships.ts`

**Functions to Implement**:
```typescript
// List autoships with filters
export async function getAllAutoships(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  userId?: string;
  productId?: string;
}): Promise<Autoship[]>

// Get autoship with runs
export async function getAutoshipById(id: string): Promise<AutoshipWithRuns | null>

// Pause autoship (admin)
export async function pauseAutoship(id: string): Promise<Autoship>

// Resume autoship (admin)
export async function resumeAutoship(id: string): Promise<Autoship>

// Cancel autoship (admin)
export async function cancelAutoship(id: string): Promise<Autoship>

// Get autoship statistics
export async function getAutoshipStats(): Promise<{
  totalActive: number;
  totalPaused: number;
  dueToday: number;
  failedLastWeek: number;
}>

// Get autoship runs for an autoship
export async function getAutoshipRuns(
  autoshipId: string,
  options?: { limit?: number; offset?: number }
): Promise<AutoshipRun[]>
```

**Types** (`apps/admin/lib/types.ts`):
```typescript
export interface Autoship {
  id: string;
  user_id: string;
  pet_id: string | null;
  product_id: string;
  quantity: number;
  frequency_weeks: number;
  next_run_at: string;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
  // Joined data
  user?: Profile;
  product?: Product;
  pet?: Pet;
}

export interface AutoshipRun {
  id: string;
  autoship_id: string;
  scheduled_at: string;
  executed_at: string | null;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  order_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AutoshipWithRuns extends Autoship {
  runs: AutoshipRun[];
}
```

---

#### B.2 Autoship List Page

**File**: `apps/admin/app/autoships/page.tsx`

**Features**:
- Table view with columns:
  - User (email)
  - Product (name + image)
  - Quantity
  - Frequency (e.g., "Every 4 weeks")
  - Next Run (date or "Paused")
  - Status (badge)
  - Created
  - Actions (View, Pause/Resume, Cancel)
- Filters:
  - Status (All, Active, Paused, Cancelled)
  - Search by user email or product name
- Pagination
- Stats cards at top: Total Active, Due Today, Failed Last Week

**Status Badge Colors**:
- `active` - Green
- `paused` - Yellow
- `cancelled` - Gray

---

#### B.3 Autoship Detail Page

**File**: `apps/admin/app/autoships/[id]/page.tsx`

**Features**:
- Autoship info card:
  - User info (name, email)
  - Product info (image, name, SKU)
  - Quantity
  - Frequency
  - Status
  - Next run date
  - Created date
  - Pet (if linked)
- Action buttons:
  - Pause (if active)
  - Resume (if paused)
  - Cancel (confirmation required)
- Execution history table:
  - Scheduled date
  - Executed date
  - Status (badge)
  - Order link (if completed)
  - Error message (if failed)

---

### Part C: Mobile Autoship Management (Week 2, Days 1-4)

#### C.1 Autoship Data Layer

**File**: `apps/mobile/lib/autoships.ts`

**Functions**:
```typescript
// Get user's autoships
export async function getUserAutoships(): Promise<Autoship[]>

// Get autoship by ID (with recent runs)
export async function getAutoshipById(id: string): Promise<AutoshipWithRuns | null>

// Create autoship
export async function createAutoship(params: {
  productId: string;
  quantity: number;
  frequencyWeeks: number;
  petId?: string;
  startDate?: string;
}): Promise<AutoshipResult>

// Update autoship
export async function updateAutoship(
  id: string,
  params: { quantity?: number; frequencyWeeks?: number }
): Promise<AutoshipResult>

// Skip next delivery
export async function skipNextAutoship(id: string): Promise<AutoshipResult>

// Pause autoship
export async function pauseAutoship(id: string): Promise<AutoshipResult>

// Resume autoship
export async function resumeAutoship(id: string): Promise<AutoshipResult>

// Cancel autoship
export async function cancelAutoship(id: string): Promise<AutoshipResult>
```

**Types** (`apps/mobile/lib/types.ts`):
```typescript
export interface Autoship {
  id: string;
  product_id: string;
  quantity: number;
  frequency_weeks: number;
  next_run_at: string;
  status: 'active' | 'paused' | 'cancelled';
  pet_id: string | null;
  created_at: string;
  // Joined data
  product?: Product;
  pet?: Pet;
}

export interface AutoshipRun {
  id: string;
  scheduled_at: string;
  executed_at: string | null;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  order_id: string | null;
}

export interface AutoshipWithRuns extends Autoship {
  runs: AutoshipRun[];
}

export interface AutoshipResult {
  success: boolean;
  autoship_id?: string;
  error?: string;
}
```

---

#### C.2 Autoship Enrollment (Product Detail)

**File**: Modify `apps/mobile/app/product/[id].tsx`

**Features**:
- "Subscribe & Save X%" button below "Add to Cart"
- Only shown if `product.autoship_eligible = true`
- Clicking opens enrollment modal:
  - Product info (image, name)
  - Quantity selector
  - Frequency selector (dropdown: 1-8, 10, 12, 16, 20, 24 weeks - Chewy-style)
  - Pet selector (optional, if user has pets)
  - Price comparison: One-time vs Autoship price
  - First delivery date
  - "Start Subscription" button

**Enrollment Flow**:
1. User taps "Subscribe & Save"
2. Modal opens with defaults (quantity: 1, frequency: 4 weeks)
3. User adjusts settings
4. User taps "Start Subscription"
5. Call `createAutoship()`
6. Show success confirmation
7. Navigate to My Autoships

---

#### C.3 Orders Screen with Autoship Tab

**File**: Modify `apps/mobile/app/(tabs)/orders.tsx`

**Structure** (Chewy-style):
```
┌─────────────────────────────────────────┐
│ Orders                            🛒    │
├─────────────────────────────────────────┤
│  [ Order History ]  [ Autoships ]       │  ← Tab selector
├─────────────────────────────────────────┤
│                                         │
│  (Content based on selected tab)        │
│                                         │
└─────────────────────────────────────────┘
```

**Tab 1: Order History** (existing functionality)
- List of past orders
- Order cards with status, date, total
- Tap to view order details

**Tab 2: Autoships** (new)
- List of user's autoships
- Autoship card:
  - Product image
  - Product name
  - Quantity × Frequency (e.g., "2 × Every 4 weeks")
  - Next delivery date (or "Paused")
  - Status badge
  - Autoship price per delivery
- Empty state: "No autoships yet. Subscribe to save!"
- "Browse Products" button in empty state
- Tap card to view/manage autoship details

**Implementation Options**:
1. **Segment Control** - iOS-style toggle at top
2. **Tab Bar** - Material-style tabs below header
3. **Swipeable Tabs** - Swipe left/right between views

**Recommended**: Material-style tabs for consistency

---

#### C.4 Autoship Detail/Management Screen

**File**: `apps/mobile/app/autoships/[id].tsx` (separate route, navigated from Orders > Autoships tab)

**Features**:
- Product info header
- Status badge
- Next delivery info:
  - Date
  - "Skip Next Delivery" button (if active)
- Subscription details:
  - Quantity (editable)
  - Frequency (editable)
  - Autoship price
  - Total per delivery
- Delivery history (recent runs):
  - Date
  - Status
  - Order link (if completed)
- Action buttons:
  - "Save Changes" (if edited)
  - "Pause Subscription" / "Resume Subscription"
  - "Cancel Subscription" (with confirmation)

**Edit Flow**:
1. User changes quantity or frequency
2. "Save Changes" button becomes enabled
3. User taps "Save Changes"
4. Call `updateAutoship()`
5. Show success toast

**Cancel Flow**:
1. User taps "Cancel Subscription"
2. Confirmation modal:
   - "Are you sure you want to cancel?"
   - "You'll lose your autoship discount."
   - "Cancel Subscription" / "Keep Subscription" buttons
3. Call `cancelAutoship()`
4. Navigate back to autoship list

---

### Part D: Testing & Validation (Week 3)

#### D.1 Backend Function Tests

**Test Scenarios**:

1. **Create Autoship**:
   - [ ] Creates with valid data
   - [ ] Calculates next_run_at correctly
   - [ ] Rejects non-eligible products
   - [ ] Rejects duplicate for same product
   - [ ] Rejects invalid frequency

2. **Update Autoship**:
   - [ ] Updates quantity
   - [ ] Updates frequency and recalculates next_run
   - [ ] Rejects updates to cancelled autoships

3. **Pause/Resume**:
   - [ ] Pause changes active to paused
   - [ ] Resume changes paused to active
   - [ ] Resume calculates new next_run_at

4. **Skip Next Delivery**:
   - [ ] Creates skipped run record
   - [ ] Advances next_run_at

5. **Execute Autoship**:
   - [ ] Creates order with autoship source
   - [ ] Applies autoship discounts
   - [ ] Creates run record
   - [ ] Idempotent execution
   - [ ] Handles inventory shortage

6. **Run Due Autoships**:
   - [ ] Finds all due autoships
   - [ ] Executes each one
   - [ ] Returns accurate summary

---

#### D.2 Idempotency Tests (CRITICAL)

```sql
-- Test: Execute same autoship twice at same scheduled_at
-- First execution
SELECT execute_autoship('autoship-id', '2026-01-17 00:00:00+00');
-- Expected: { "success": true, "order_id": "xxx", "already_executed": false }

-- Second execution (same parameters)
SELECT execute_autoship('autoship-id', '2026-01-17 00:00:00+00');
-- Expected: { "success": true, "order_id": "xxx", "already_executed": true }
-- MUST return same order_id, NOT create new order
```

---

## 7. Acceptance Criteria

Phase 5 is complete when:

**Backend**:
- [ ] `create_autoship()` creates subscriptions correctly
- [ ] `execute_autoship()` is idempotent
- [ ] Autoship orders apply autoship discounts
- [ ] `run_due_autoships()` processes all due autoships
- [ ] Skip, pause, resume, cancel all work correctly
- [ ] Autoship_runs provides complete audit trail

**Admin App**:
- [ ] Autoship list with filtering
- [ ] Autoship detail with execution history
- [ ] Admin can pause/resume/cancel autoships
- [ ] Dashboard shows autoship statistics

**Mobile App**:
- [ ] User can enroll in autoship from product page
- [ ] User can view all their autoships
- [ ] User can skip next delivery
- [ ] User can change quantity and frequency
- [ ] User can pause/resume autoship
- [ ] User can cancel autoship
- [ ] Autoship orders appear in order history with correct source

---

## 8. Navigation Updates

### Mobile App Bottom Tabs (Unchanged)

- Shop
- **Orders** (contains Order History + Autoships tabs)
- Pets
- Account

### Orders Screen Structure (Chewy-style)

**Orders page now has two internal tabs:**

```
Orders Screen
├── Tab: Order History (default)
│   └── List of past orders (existing)
└── Tab: Autoships
    └── List of active subscriptions (new)
```

**Benefits**:
- Keeps bottom navigation clean (4 tabs)
- Groups order-related content together
- Matches Chewy.com pattern
- Users intuitively find subscriptions under "Orders"

### Admin Sidebar

**Updated Navigation**:
- Dashboard
- Products
- Discounts
- Families
- Tags
- Orders
- Inventory
- **Autoships** (new)

---

## 9. Scheduler Setup

### Option A: Supabase pg_cron (Recommended)

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule autoship execution every hour
SELECT cron.schedule(
  'run-due-autoships',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT public.run_due_autoships()$$
);
```

### Option B: External Scheduler

Use external cron service (Vercel Cron, AWS EventBridge, etc.) to call Supabase Edge Function.

**Edge Function**: `supabase/functions/run-autoships/index.ts`
```typescript
// Called by external scheduler
// Calls run_due_autoships() and logs results
```

---

## 10. Risk Mitigation

**Risk**: Duplicate order creation
**Mitigation**: Idempotency key (autoship_id + scheduled_at date), always check autoship_runs first

**Risk**: Failed autoship keeps retrying forever
**Mitigation**: Track consecutive failures, pause autoship after N failures, alert admin

**Risk**: User charged for unwanted autoship
**Mitigation**: Easy skip/pause/cancel in app, confirmation emails before execution

**Risk**: Inventory sold out between orders
**Mitigation**: Graceful failure handling, notify user, don't advance next_run

**Risk**: Price changes affect user unexpectedly
**Mitigation**: Show current autoship price in management screen, notify on significant changes

---

## 11. Success Metrics

After Phase 5, you should be able to:
- [ ] User enrolls in autoship from product page
- [ ] Autoship order created automatically at scheduled time
- [ ] Autoship order has correct discounted price
- [ ] User can skip next delivery
- [ ] User can change frequency
- [ ] User can pause and resume
- [ ] User can cancel
- [ ] Admin can view all autoships
- [ ] Admin can manage autoships
- [ ] Duplicate execution doesn't create duplicate orders

**Demo Flow**:
1. User views product with autoship option
2. User taps "Subscribe & Save 10%"
3. User selects quantity and frequency
4. User starts subscription
5. Autoship appears in Orders > Autoships tab
6. Scheduled execution creates order with autoship discount
7. Order appears in Orders > Order History tab (source: autoship)
8. User goes to Orders > Autoships tab
9. User skips next delivery
10. User changes frequency
11. User cancels subscription

---

## End of Phase 5 Plan

This plan provides a complete roadmap for implementing the autoship subscription system. The key technical challenge is ensuring idempotent execution to prevent duplicate orders.

**Next Phase**: Phase 6 (Pet Portal & Personalization)

---

## How to Checkout with Autoship

### Current Implementation Status

**✅ Available**: Autoship enrollment from product detail page
**📋 Ready to Implement**: Chewy-style autoship enrollment during checkout

### Current Flow (Product Page Enrollment):

1. User views a product with `autoship_eligible = true`
2. Sees "Subscribe & Save X%" button
3. Taps button → Enrollment modal opens
4. Selects quantity and frequency
5. Taps "Start Subscription"
6. Autoship is created (no immediate order)
7. First order will be created automatically on `next_run_at` date

### Chewy-Style Checkout Enrollment (Ready to Implement)

**Full implementation guide**: `Phase_5_Checkout_Autoship_Enrollment.md`

**How it differs from current approach:**

| Aspect | Current (Product Page) | Chewy-Style (Checkout) |
|--------|------------------------|------------------------|
| When enrolled | Product detail page | During checkout |
| First order | Waits for scheduled date | **Placed immediately** |
| Autoship discount | Applied on first scheduled delivery | **Applied on immediate order** |
| User gets product | After frequency period | **Right away** |

**What the implementation includes:**
1. New backend function `create_autoship_with_order()` - atomically creates subscription + immediate order
2. Subscribe & Save toggle for each eligible cart item in checkout
3. Frequency selector (1-8, 10, 12, 16, 20, 24 weeks)
4. Price comparison showing savings
5. Mixed cart support (autoship + one-time items in same checkout)
6. Enhanced confirmation screen showing both order and subscription details

**Files to modify:**
- `supabase/migrations/0026_autoship_with_order.sql` - New backend function
- `apps/mobile/lib/autoships.ts` - Add `createAutoshipWithOrder()`
- `apps/mobile/contexts/CartContext.tsx` - Add `autoship_eligible` to CartItem
- `apps/mobile/app/checkout/index.tsx` - Main UI and logic changes
