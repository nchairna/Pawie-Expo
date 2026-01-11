# Phase 4 — Orders & Checkout (Simulated Payment)

**Product**: Pawie
**Phase**: 4
**Status**: In Progress (Part A & B Complete - Backend Functions + Admin UI)
**Last Updated**: 2026-01-09
**Estimated Duration**: 3 weeks
**Progress**: ~40% (Backend + Admin complete, Mobile pending)

---

## 1. Goal

Implement a complete order flow where customers can:
- Manage a shopping cart
- Place one-time orders with address selection
- View order history and details
- See locked price snapshots on orders

Admin can:
- View and manage all orders
- Update order status
- Manage inventory with adjustments
- View inventory movement history

**Key Principle**: Inventory must never go negative. All inventory changes are transaction-safe with audit logging.

**Payment Strategy (MVP)**: Simulated payment flow without real payment provider integration.
- Orders are created with status `pending`
- Admin manually marks orders as `paid` to simulate payment confirmation
- Future Phase: Integrate real payment provider (Midtrans, Xendit, etc.)

---

## 2. Canonical References

This phase MUST align with:
- **Doc 03** — Data Model (orders, order_items, inventory schema)
- **Doc 04** — API & Data Flow (order creation flow)
- **Doc 07** — Overall Plan (Phase 4 requirements)

**Conflict Resolution**: If code conflicts with these docs, documentation takes precedence.

---

## 3. Scope

### Included in Phase 4:

**Backend**:
- [x] `check_product_availability()` function - Check inventory availability
- [x] `decrement_inventory()` function - Transaction-safe inventory decrement
- [x] `create_order_with_inventory()` function - Atomic order creation
- [x] `update_order_status()` function - Admin order status updates
- [x] `adjust_inventory()` function - Admin inventory adjustments
- [x] Inventory movement audit logging
- [ ] Order RLS policies verified

**Admin App**:
- [x] Order list page (`/orders`) with filtering and search ✅
- [x] Order detail page (`/orders/[id]`) with status updates ✅
- [x] Inventory management page (`/inventory`) ✅
- [x] Inventory adjustment with reason codes ✅
- [x] Inventory movement history view ✅

**Mobile App**:
- [ ] Cart context/state management
- [ ] Cart screen with item management
- [ ] Checkout flow with address selection
- [ ] Address CRUD (create, edit, select)
- [ ] Order confirmation screen
- [ ] Order history screen (`/orders`)
- [ ] Order detail screen (`/orders/[id]`)
- [ ] Price breakdown display (using Phase 3 pricing)

### Excluded (Future Phases):
- Real payment gateway integration (Midtrans, Xendit)
- Payment webhooks and callbacks
- Autoship order creation (Phase 5)
- Shipping carrier integration
- Email notifications (Phase 5+)

---

## 4. Prerequisites

Before starting Phase 4, ensure:
- [x] Phase 3 is 100% complete (pricing engine working)
- [x] `compute_product_price()` function working
- [x] Products table has `base_price_idr` column
- [x] Inventory table exists with RLS
- [x] Orders and order_items tables exist with RLS
- [x] Addresses table exists with RLS
- [x] Mobile and admin auth working

---

## 5. Implementation Plan

### Part A: Backend Order Functions (Week 1, Days 1-3)

#### A.1 Check Product Availability Function

**File**: `supabase/migrations/0020_order_functions.sql`

**Function**: `check_product_availability()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.check_product_availability(
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Returns:
-- {
--   "available": true,
--   "stock_quantity": 50,
--   "requested_quantity": 2,
--   "product_id": "uuid",
--   "product_name": "Product Name"
-- }
$$;
```

**Logic**:
1. Validate product exists and is published
2. Get current stock from `inventory` table
3. Compare with requested quantity
4. Return availability status

**Error Handling**:
- Product not found: `{ "available": false, "error": "PRODUCT_NOT_FOUND" }`
- Product not published: `{ "available": false, "error": "PRODUCT_NOT_PUBLISHED" }`
- Insufficient stock: `{ "available": false, "error": "INSUFFICIENT_STOCK", "stock_quantity": X }`

**Testing Checklist**:
- [x] Returns `available: true` when stock sufficient
- [x] Returns `available: false` when stock insufficient
- [x] Returns error when product not found
- [x] Returns error when product not published
- [x] Works with zero stock (returns unavailable)
- [x] Handles null quantity gracefully

---

#### A.2 Decrement Inventory Function

**File**: Same migration (`0020_order_functions.sql`)

**Function**: `decrement_inventory()`

**Signature**:
```sql
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
-- Returns:
-- {
--   "success": true,
--   "new_stock": 48,
--   "previous_stock": 50,
--   "decremented": 2,
--   "movement_id": "uuid"
-- }
$$;
```

**Logic**:
1. Lock inventory row for update (SELECT FOR UPDATE)
2. Validate current stock >= requested quantity
3. Decrement stock_quantity
4. Insert inventory_movement record (audit log)
5. Return new stock level

**Transaction Safety**:
- Uses `SELECT FOR UPDATE` to prevent race conditions
- Entire operation in single transaction
- Rollback on any failure

**Error Handling**:
- Insufficient stock: Raise exception (transaction rollback)
- Product not found: Raise exception

**Testing Checklist**:
- [x] Decrements stock correctly
- [x] Creates inventory_movement record
- [x] Fails when stock insufficient (no partial decrement)
- [x] Transaction-safe (concurrent requests handled)
- [x] Reference ID stored correctly (order_id link)

---

#### A.3 Create Order with Inventory Function

**File**: Same migration (`0020_order_functions.sql`)

**Function**: `create_order_with_inventory()`

**Signature**:
```sql
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
-- Returns:
-- {
--   "success": true,
--   "order_id": "uuid",
--   "status": "pending",
--   "subtotal_idr": 500000,
--   "discount_total_idr": 50000,
--   "total_price_idr": 450000,
--   "items": [...]
-- }
$$;
```

**Logic Flow**:
1. Validate user exists (can be passed user_id or use auth.uid())
2. Validate all products exist and are published
3. Validate inventory availability for ALL items (pre-check)
4. For each item:
   - Call `compute_product_price(product_id, user_id, is_autoship, quantity)`
   - Store computed prices
5. Calculate order totals:
   - `subtotal_idr` = sum of (unit_base_price × quantity)
   - `discount_total_idr` = sum of item discounts
   - `total_price_idr` = subtotal - discount
6. Insert `orders` row with status = 'pending'
7. Insert `order_items` with price snapshots:
   - `unit_base_price_idr` = base price at order time
   - `unit_final_price_idr` = final price after discounts
   - `discount_total_idr` = discount for this item
   - `discount_breakdown` = JSONB with discount details
8. Decrement inventory for each item (calls `decrement_inventory()`)
9. Return order confirmation

**Transaction Safety**:
- Entire operation wrapped in transaction
- If any step fails, entire order rolls back
- Inventory only decremented after all validations pass
- Uses row-level locking for inventory

**Error Handling**:
```json
{ "success": false, "error": "INSUFFICIENT_INVENTORY", "product_id": "uuid", "available": 5, "requested": 10 }
{ "success": false, "error": "PRODUCT_NOT_FOUND", "product_id": "uuid" }
{ "success": false, "error": "PRODUCT_NOT_PUBLISHED", "product_id": "uuid" }
{ "success": false, "error": "EMPTY_ORDER" }
{ "success": false, "error": "INVALID_QUANTITY", "product_id": "uuid" }
```

**Testing Checklist**:
- [x] Creates order with correct totals
- [x] Creates order_items with price snapshots
- [x] Decrements inventory correctly
- [x] Creates inventory_movement records
- [x] Fails atomically (all or nothing)
- [x] Handles multiple items correctly
- [ ] Works with autoship source (applies autoship discount) - *Tested with one_time, autoship pending*
- [x] Stores discount_breakdown JSONB
- [x] Order status is 'pending'

---

#### A.4 Update Order Status Function

**File**: Same migration (`0020_order_functions.sql`)

**Function**: `update_order_status()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Returns:
-- {
--   "success": true,
--   "order_id": "uuid",
--   "previous_status": "pending",
--   "new_status": "paid"
-- }
$$;
```

**Valid Status Transitions**:
```
pending → paid (simulated payment confirmation)
pending → cancelled (user/admin cancellation)
paid → processing (admin starts processing)
processing → shipped (admin ships order)
shipped → delivered (delivery confirmation)
paid → refunded (refund processed)
processing → refunded (refund processed)
```

**Logic**:
1. Validate order exists
2. Validate status transition is allowed
3. Update order status
4. Update `updated_at` timestamp
5. Return confirmation

**Cancellation Logic** (status → cancelled):
- Restore inventory for all order items
- Create inventory_movement with reason 'order_cancelled'
- Only allowed from 'pending' status

**Testing Checklist**:
- [x] Valid transitions work correctly
- [x] Invalid transitions rejected
- [x] Cancellation restores inventory
- [x] Updated_at timestamp changes
- [x] Returns previous and new status

---

#### A.5 Adjust Inventory Function (Admin)

**File**: Same migration (`0020_order_functions.sql`)

**Function**: `adjust_inventory()`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_adjustment integer,  -- positive = add, negative = remove
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
-- Returns:
-- {
--   "success": true,
--   "product_id": "uuid",
--   "previous_stock": 50,
--   "adjustment": 10,
--   "new_stock": 60,
--   "movement_id": "uuid"
-- }
$$;
```

**Reason Codes** (suggested):
- `restock` - New inventory received
- `damaged` - Damaged items removed
- `lost` - Lost/missing items
- `audit_correction` - Inventory audit adjustment
- `return` - Customer return processed
- `manual_adjustment` - Manual admin adjustment

**Logic**:
1. Validate admin authorization
2. Get current stock
3. Calculate new stock (current + adjustment)
4. Validate new stock >= 0 (cannot go negative)
5. Update inventory
6. Insert inventory_movement record
7. Return confirmation

**Testing Checklist**:
- [x] Positive adjustment adds stock
- [x] Negative adjustment removes stock
- [x] Cannot adjust below zero
- [x] Creates movement record with reason
- [x] Only admin can call (RLS/authorization) - *Function uses SECURITY DEFINER, RLS enforced via permissions*

---

#### A.6 Test Data and Validation

**File**: `supabase/migrations/0021_order_test_data.sql` *(Optional - testing done directly)*

**Purpose**: Seed test inventory for development

**Status**: ✅ Functions tested directly in database. Test data migration optional.

**Test Scenarios**:
1. Product with sufficient stock (50+ units)
2. Product with low stock (5 units)
3. Product with zero stock
4. Product without inventory record

**Validation Queries**:
```sql
-- Test 1: Check availability (sufficient stock)
SELECT check_product_availability('product-id', 2);
-- Expected: { "available": true, "stock_quantity": 50 }

-- Test 2: Check availability (insufficient stock)
SELECT check_product_availability('product-id', 100);
-- Expected: { "available": false, "error": "INSUFFICIENT_STOCK" }

-- Test 3: Create order (success)
SELECT create_order_with_inventory(
  'user-id',
  '[{"product_id": "uuid", "quantity": 2}]'::jsonb,
  'address-id',
  'one_time'
);
-- Expected: { "success": true, "order_id": "uuid", ... }

-- Test 4: Create order (insufficient stock - should fail)
SELECT create_order_with_inventory(
  'user-id',
  '[{"product_id": "uuid", "quantity": 1000}]'::jsonb,
  null,
  'one_time'
);
-- Expected: { "success": false, "error": "INSUFFICIENT_INVENTORY" }
```

---

### Part B: Admin Order Management (Week 1, Days 4-5)

#### B.1 Data Access Layer

**File**: `apps/admin/lib/orders.ts`

**Functions to Implement**:
```typescript
// List orders with filters
export async function getAllOrders(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  source?: string;
  search?: string;  // Search by order ID or user email
  startDate?: string;
  endDate?: string;
}): Promise<Order[]>

// Get order with items
export async function getOrderById(id: string): Promise<OrderWithItems | null>

// Update order status
export async function updateOrderStatus(
  orderId: string,
  newStatus: string
): Promise<Order>

// Get order statistics
export async function getOrderStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  totalRevenue: number;
}>
```

**File**: `apps/admin/lib/inventory.ts`

**Functions to Implement**:
```typescript
// List inventory with product info
export async function getAllInventory(options?: {
  limit?: number;
  offset?: number;
  lowStock?: boolean;  // Filter products with stock < threshold
  outOfStock?: boolean;
}): Promise<InventoryWithProduct[]>

// Get inventory for a product
export async function getInventoryByProductId(
  productId: string
): Promise<Inventory | null>

// Adjust inventory
export async function adjustInventory(
  productId: string,
  adjustment: number,
  reason: string
): Promise<Inventory>

// Get inventory movements for a product
export async function getInventoryMovements(
  productId: string,
  options?: { limit?: number; offset?: number }
): Promise<InventoryMovement[]>
```

**Types** (`apps/admin/lib/types.ts`):
```typescript
export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  source: 'one_time' | 'autoship';
  subtotal_idr: number;
  discount_total_idr: number;
  total_price_idr: number;
  shipping_address_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: Profile;
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_base_price_idr: number;
  unit_final_price_idr: number;
  discount_total_idr: number;
  discount_breakdown: DiscountBreakdown[];
  created_at: string;
  // Joined data
  product?: Product;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface Inventory {
  id: string;
  product_id: string;
  stock_quantity: number;
  updated_at: string;
  // Joined data
  product?: Product;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  change_quantity: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
}

export interface InventoryWithProduct extends Inventory {
  product: Product;
}
```

**Testing Checklist**:
- [x] All CRUD operations work ✅
- [x] RLS policies enforced (admin-only) ✅
- [x] Filtering works correctly ✅
- [x] Pagination works ✅
- [x] Status updates call database function ✅

---

#### B.2 Order List Page

**File**: `apps/admin/app/orders/page.tsx`

**Features**:
- Table view with columns:
  - Order ID (truncated UUID)
  - Customer (email)
  - Status (badge with color)
  - Source (One-Time / Autoship badge)
  - Items Count
  - Total (formatted IDR)
  - Date (relative time)
  - Actions (View)
- Filters:
  - Status filter (dropdown: all, pending, paid, processing, shipped, delivered, cancelled)
  - Source filter (dropdown: all, one_time, autoship)
  - Date range picker
- Search by order ID or customer email
- Pagination
- Empty state: "No orders yet."

**Status Badge Colors**:
- `pending` - Yellow
- `paid` - Blue
- `processing` - Purple
- `shipped` - Cyan
- `delivered` - Green
- `cancelled` - Gray
- `refunded` - Red

**UI Components** (shadcn/ui):
- Table
- Badge
- Input (search)
- Select (filters)
- DatePicker (date range)
- Button

**Testing Checklist**:
- [x] List loads all orders ✅
- [x] Status filter works ✅
- [x] Source filter works ✅
- [x] Search works (order ID) ✅ *Email search pending*
- [ ] Date range filter works *Not yet implemented*
- [x] Pagination works ✅
- [x] Empty state shows when no orders ✅
- [x] Navigation to detail page works ✅

---

#### B.3 Order Detail Page

**File**: `apps/admin/app/orders/[id]/page.tsx`

**Features**:
- Order summary card:
  - Order ID
  - Status (with update dropdown)
  - Source
  - Created date
  - Customer info (name, email)
  - Shipping address
- Price summary:
  - Subtotal
  - Discount total (with breakdown)
  - Final total
- Order items table:
  - Product image
  - Product name
  - SKU
  - Quantity
  - Unit base price
  - Unit final price
  - Line discount
  - Line total
- Status update section:
  - Status dropdown
  - "Update Status" button
  - Confirmation for cancellation (warns about inventory restoration)
- Order timeline (optional):
  - Created
  - Status changes
  - Updated

**Status Update Flow**:
1. Admin selects new status from dropdown
2. If cancelling: Show confirmation dialog
3. Call `updateOrderStatus()` function
4. Show success/error toast
5. Refresh order data

**Testing Checklist**:
- [x] Order details load correctly ✅
- [x] Items display with price breakdown ✅
- [x] Status update works ✅
- [x] Cancellation restores inventory ✅
- [x] Invalid transitions show error ✅
- [x] Price formatting correct (IDR) ✅
- [x] Discount breakdown displays ✅

---

#### B.4 Inventory Management Page

**File**: `apps/admin/app/inventory/page.tsx`

**Features**:
- Table view with columns:
  - Product image
  - Product name
  - SKU
  - Current stock
  - Status (In Stock / Low Stock / Out of Stock)
  - Last updated
  - Actions (Adjust, View History)
- Filters:
  - Stock status (All, In Stock, Low Stock, Out of Stock)
  - Search by product name/SKU
- Low stock threshold: 10 units (configurable)
- Pagination

**Stock Status Logic**:
- `Out of Stock`: stock_quantity = 0
- `Low Stock`: stock_quantity > 0 AND stock_quantity <= 10
- `In Stock`: stock_quantity > 10

**Adjust Inventory Modal**:
- Product name (readonly)
- Current stock (readonly)
- Adjustment type: Add Stock / Remove Stock
- Quantity input
- Reason dropdown:
  - Restock (add only)
  - Damaged (remove only)
  - Lost (remove only)
  - Audit Correction (add/remove)
  - Customer Return (add only)
  - Manual Adjustment (add/remove)
- Notes (optional text)
- "Apply Adjustment" button

**Testing Checklist**:
- [x] Inventory list loads correctly ✅
- [x] Stock status badges correct ✅
- [x] Filters work ✅
- [x] Search works ✅
- [x] Adjustment modal works ✅
- [x] Positive adjustment adds stock ✅
- [x] Negative adjustment removes stock ✅
- [x] Cannot adjust below zero ✅
- [x] Success toast shows ✅

---

#### B.5 Inventory Movement History

**File**: `apps/admin/app/inventory/[productId]/movements/page.tsx`

**Features**:
- Product info header
- Current stock display
- Movement history table:
  - Date/time
  - Change (+ or - with quantity)
  - Reason
  - Reference (link to order if applicable)
  - New stock after change
- Pagination
- Back to inventory list link

**Testing Checklist**:
- [x] Movements load correctly ✅
- [x] Change displays with +/- sign ✅
- [x] Order reference links work ✅
- [x] Chronological order (newest first) ✅
- [x] Pagination works ✅

---

### Part C: Mobile Cart & Checkout (Week 2, Days 1-4)

#### C.1 Cart Context/State

**File**: `apps/mobile/contexts/CartContext.tsx`

**State Structure**:
```typescript
interface CartItem {
  product_id: string;
  quantity: number;
  // Cached product data (for display)
  product: {
    name: string;
    primary_image_path: string | null;
    base_price_idr: number;
    sku: string | null;
  };
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  isLoading: boolean;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartPricing: () => Promise<CartPricing>;
}
```

**Persistence**:
- Store cart in AsyncStorage
- Load on app start
- Sync across sessions

**Functions**:
```typescript
// Add item to cart
addItem(productId: string, quantity: number = 1): Promise<void>
// - Fetch product data if not cached
// - Add to cart or increment quantity
// - Persist to storage

// Remove item from cart
removeItem(productId: string): void
// - Remove from cart
// - Persist to storage

// Update item quantity
updateQuantity(productId: string, quantity: number): void
// - Update quantity (min 1)
// - If quantity = 0, remove item
// - Persist to storage

// Clear entire cart
clearCart(): void
// - Remove all items
// - Persist to storage

// Get cart pricing (server-side computation)
getCartPricing(isAutoship: boolean = false): Promise<CartPricing>
// - Call compute_product_price() for each item
// - Return totals and breakdown
```

**Testing Checklist**:
- [ ] Add item works
- [ ] Remove item works
- [ ] Update quantity works
- [ ] Clear cart works
- [ ] Persistence works (reload app)
- [ ] Cart badge updates correctly
- [ ] Pricing computation works

---

#### C.2 Cart Screen

**File**: `apps/mobile/app/(tabs)/cart.tsx`

**Features**:
- Cart items list:
  - Product image
  - Product name
  - SKU
  - Unit price (base, strikethrough if discounted)
  - Quantity selector (+ / - buttons)
  - Line total
  - Remove button
- Empty cart state: "Your cart is empty. Start shopping!"
- Price summary:
  - Subtotal (sum of base prices)
  - Discounts applied (list)
  - Total
- "Proceed to Checkout" button
- "Continue Shopping" link

**Quantity Selector**:
- Min: 1
- Max: Stock quantity (or 99)
- Debounced updates (prevent rapid clicks)

**Testing Checklist**:
- [ ] Cart items display correctly
- [ ] Quantity increment works
- [ ] Quantity decrement works (min 1)
- [ ] Remove item works
- [ ] Price summary updates
- [ ] Empty state shows when empty
- [ ] Checkout navigation works
- [ ] Images load correctly

---

#### C.3 Address Management

**File**: `apps/mobile/lib/addresses.ts`

**Functions**:
```typescript
// Get user's addresses
export async function getUserAddresses(): Promise<Address[]>

// Create new address
export async function createAddress(data: AddressInput): Promise<Address>

// Update address
export async function updateAddress(id: string, data: Partial<AddressInput>): Promise<Address>

// Delete address
export async function deleteAddress(id: string): Promise<void>

// Set default address (optional)
export async function setDefaultAddress(id: string): Promise<void>
```

**File**: `apps/mobile/app/addresses/index.tsx` (Address List)

**Features**:
- List of saved addresses
- Add new address button
- Edit/delete actions per address
- Select address (for checkout)

**File**: `apps/mobile/app/addresses/new.tsx` (Create Address)

**Features**:
- Form fields:
  - Label (e.g., "Home", "Office")
  - Address line
  - City
  - Province
  - Postal code
- Validation
- Save button

**Testing Checklist**:
- [ ] List addresses works
- [ ] Create address works
- [ ] Edit address works
- [ ] Delete address works
- [ ] Validation works
- [ ] Back navigation works

---

#### C.4 Checkout Flow

**File**: `apps/mobile/app/checkout/index.tsx`

**Flow Steps**:
1. **Cart Summary**: Review items and totals
2. **Address Selection**: Select or add shipping address
3. **Order Review**: Final review before placing order
4. **Order Confirmation**: Success screen with order details

**Step 1: Cart Summary**
- Display cart items (readonly)
- Display price breakdown
- "Continue" button

**Step 2: Address Selection**
- List saved addresses
- "Add New Address" button
- Select address radio
- "Continue" button (disabled until address selected)

**Step 3: Order Review**
- Cart items summary
- Selected address
- Price breakdown (final)
- "Place Order" button (with simulated payment note)
- Terms acceptance checkbox (optional)

**Simulated Payment Flow**:
```
┌─────────────────────────────────────────┐
│ Order Review                            │
├─────────────────────────────────────────┤
│ [Cart items summary]                    │
│                                         │
│ Shipping to:                            │
│ [Selected address]                      │
│                                         │
│ Subtotal: Rp 500,000                    │
│ Discounts: -Rp 50,000                   │
│ Total: Rp 450,000                       │
│                                         │
│ ⚠️ Payment Simulation                   │
│ In this MVP version, orders are placed  │
│ with "pending" status. Our team will    │
│ contact you for payment instructions.   │
│                                         │
│ [Place Order]                           │
└─────────────────────────────────────────┘
```

**Step 4: Order Confirmation**
- Success message
- Order ID
- Order summary
- "View Order Details" button
- "Continue Shopping" button
- Clear cart after successful order

**Testing Checklist**:
- [ ] Cart summary displays correctly
- [ ] Address selection works
- [ ] Add new address during checkout works
- [ ] Order review shows correct data
- [ ] Place order creates order in database
- [ ] Inventory decremented
- [ ] Order confirmation displays
- [ ] Cart cleared after order
- [ ] Error handling (insufficient stock, etc.)

---

#### C.5 Order History Screen

**File**: `apps/mobile/app/(tabs)/orders.tsx`

**Features**:
- List of user's orders (newest first)
- Order card:
  - Order ID (truncated)
  - Date
  - Status badge
  - Item count
  - Total
  - Primary product image
- Pull to refresh
- Pagination / infinite scroll
- Empty state: "No orders yet. Start shopping!"
- Tap to view order details

**Testing Checklist**:
- [ ] Orders load correctly
- [ ] Status badges show
- [ ] Pagination works
- [ ] Pull to refresh works
- [ ] Empty state shows
- [ ] Navigation to detail works

---

#### C.6 Order Detail Screen

**File**: `apps/mobile/app/orders/[id].tsx`

**Features**:
- Order status header:
  - Status badge
  - Order ID
  - Order date
- Status timeline (visual progress):
  - Pending → Paid → Processing → Shipped → Delivered
- Shipping address
- Order items:
  - Product image
  - Product name
  - Quantity
  - Unit price
  - Line total
- Price breakdown:
  - Subtotal
  - Discounts (with names)
  - Total

**Status Timeline Visual**:
```
Pending ──○── Paid ──○── Processing ──○── Shipped ──○── Delivered
   ✓         ✓            ●              ○              ○
```
(● = current, ✓ = completed, ○ = pending)

**Testing Checklist**:
- [ ] Order loads correctly
- [ ] Status timeline shows
- [ ] Items display correctly
- [ ] Price breakdown accurate
- [ ] Address displays
- [ ] Back navigation works

---

### Part D: Mobile Data Layer (Week 2, Day 3)

#### D.1 Orders Library

**File**: `apps/mobile/lib/orders.ts`

**Functions**:
```typescript
// Get user's orders
export async function getUserOrders(options?: {
  limit?: number;
  offset?: number;
}): Promise<Order[]>

// Get order by ID (with items)
export async function getOrderById(orderId: string): Promise<OrderWithItems | null>

// Create order
export async function createOrder(
  items: { product_id: string; quantity: number }[],
  addressId: string | null
): Promise<OrderResult>

// Check if order belongs to current user
export async function isUserOrder(orderId: string): Promise<boolean>
```

**Types** (`apps/mobile/lib/types.ts`):
```typescript
export interface Order {
  id: string;
  status: string;
  source: string;
  subtotal_idr: number;
  discount_total_idr: number;
  total_price_idr: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_base_price_idr: number;
  unit_final_price_idr: number;
  discount_total_idr: number;
  product?: Product;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  address?: Address;
}

export interface OrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
}
```

**Testing Checklist**:
- [ ] Get orders works (RLS enforced - own orders only)
- [ ] Get order by ID works
- [ ] Create order calls function correctly
- [ ] Error handling works

---

### Part E: Testing & Validation (Week 3)

#### E.1 Backend Function Tests

**Test Scenarios**:

1. **Check Availability**:
   - [ ] Product with sufficient stock returns available
   - [ ] Product with insufficient stock returns unavailable
   - [ ] Product with zero stock returns unavailable
   - [ ] Non-existent product returns error
   - [ ] Unpublished product returns error

2. **Decrement Inventory**:
   - [ ] Decrements stock correctly
   - [ ] Creates movement record
   - [ ] Fails when stock insufficient
   - [ ] Transaction rollback on failure
   - [ ] Concurrent decrements handled correctly

3. **Create Order**:
   - [ ] Creates order with correct totals
   - [ ] Creates order items with price snapshots
   - [ ] Decrements inventory
   - [ ] Applies discounts correctly
   - [ ] Handles autoship source
   - [ ] Fails atomically on inventory shortage
   - [ ] Fails on non-existent product
   - [ ] Fails on unpublished product

4. **Update Order Status**:
   - [ ] Valid transitions work
   - [ ] Invalid transitions rejected
   - [ ] Cancellation restores inventory
   - [ ] Status changes logged

5. **Adjust Inventory**:
   - [ ] Positive adjustment adds stock
   - [ ] Negative adjustment removes stock
   - [ ] Cannot go negative
   - [ ] Creates movement record

---

#### E.2 Admin UI Tests

**Order List**:
- [ ] Orders load
- [ ] Filters work
- [ ] Search works
- [ ] Pagination works
- [ ] Navigation to detail works

**Order Detail**:
- [ ] Order data loads
- [ ] Items display correctly
- [ ] Status update works
- [ ] Cancellation works (with inventory restore)
- [ ] Invalid status transitions rejected

**Inventory Management**:
- [ ] Inventory loads
- [ ] Filters work
- [ ] Adjustment modal works
- [ ] Stock updates correctly
- [ ] Movement history displays

---

#### E.3 Mobile UI Tests

**Cart**:
- [ ] Add to cart works (from product detail)
- [ ] Cart displays items
- [ ] Quantity update works
- [ ] Remove item works
- [ ] Clear cart works
- [ ] Pricing updates correctly
- [ ] Persistence works

**Checkout**:
- [ ] Flow completes successfully
- [ ] Address selection works
- [ ] Order created correctly
- [ ] Inventory decremented
- [ ] Error handling works (insufficient stock)
- [ ] Cart cleared after success

**Order History**:
- [ ] Orders load
- [ ] Detail view works
- [ ] Status displays correctly
- [ ] Price breakdown accurate

---

## 6. Acceptance Criteria (Phase 4 Complete)

Phase 4 is complete when:

**Backend**:
- [x] `check_product_availability()` function works correctly ✅
- [x] `decrement_inventory()` is transaction-safe ✅
- [x] `create_order_with_inventory()` creates orders atomically ✅
- [x] `update_order_status()` handles transitions correctly ✅
- [x] `adjust_inventory()` works for admin adjustments ✅
- [x] Inventory never goes negative ✅
- [x] All movements are logged ✅

**Admin App**:
- [x] Order list with filtering and search ✅
- [x] Order detail with status updates ✅
- [x] Inventory management with adjustments ✅
- [x] Movement history view ✅
- [x] RLS policies enforced ✅

**Mobile App**:
- [ ] Cart management works
- [ ] Checkout flow completes
- [ ] Address management works
- [ ] Order history displays
- [ ] Order detail displays
- [ ] Price breakdowns accurate

**Integration**:
- [x] Orders created with price snapshots from Phase 3 ✅
- [x] Inventory decremented on order ✅
- [x] Inventory restored on cancellation ✅
- [x] Admin can process orders ✅ *Backend + UI complete*
- [ ] User can view their orders only (RLS) - *RLS policies exist, needs verification*

---

## 7. Simulated Payment Notes

### Current Implementation (Phase 4)

**Flow**:
1. User places order via checkout
2. Order created with `status = 'pending'`
3. Inventory decremented immediately
4. User receives order confirmation (pending payment)
5. Admin views order in dashboard
6. Admin manually updates status to `paid` (simulating payment receipt)
7. Order continues through processing → shipped → delivered

**User Communication**:
- Checkout shows message: "Our team will contact you for payment instructions"
- Order confirmation shows: "Order placed! Awaiting payment confirmation."
- Order status shows: "Pending - Awaiting Payment"

### Future Payment Integration (Phase 7+)

**Options**:
1. **Midtrans** (Indonesia payment gateway)
2. **Xendit** (Indonesia payment gateway)
3. **Stripe** (International, limited Indonesia support)

**Integration Pattern**:
1. User initiates checkout
2. Create payment intent with gateway
3. Redirect to payment page OR show payment modal
4. Webhook receives payment confirmation
5. Update order status to `paid`
6. Proceed with order processing

---

## 8. Migration Files Checklist

- [x] `0020_order_functions.sql` - Core order functions ✅ Applied
- [ ] `0021_order_test_data.sql` - Test inventory data (optional)
- [x] Verify orders table has all columns from Doc 03 - ✅ Added `shipping_address_id`
- [x] Verify order_items table has price snapshot columns
- [x] Verify inventory table exists
- [x] Verify inventory_movements table exists
- [x] Verify addresses table exists
- [x] Apply migrations via Supabase CLI - ✅ Applied via Supabase MCP

---

## 9. Implementation Sequence (Recommended)

**Week 1 (Backend + Admin)**: ✅ **COMPLETE**
- Day 1-2: Backend order functions ✅
- Day 3: Test functions in SQL Editor ✅
- Day 4: Admin order list and detail pages ✅
- Day 5: Admin inventory management ✅

**Week 2 (Mobile)**:
- Day 1: Cart context and screen
- Day 2: Address management
- Day 3: Checkout flow
- Day 4: Order history and detail screens
- Day 5: Integration testing

**Week 3 (Testing + Polish)**:
- Day 1-2: Backend function tests
- Day 3: Admin UI tests
- Day 4: Mobile UI tests
- Day 5: Bug fixes and polish

---

## 10. Success Metrics

After Phase 4, you should be able to:
- [ ] User adds products to cart - *Backend ready, UI pending*
- [ ] User completes checkout flow - *Backend ready, UI pending*
- [x] Order created with price snapshots ✅ *Backend complete*
- [x] Inventory decremented correctly ✅ *Backend complete*
- [x] Admin sees new order in dashboard ✅ *Backend + UI complete*
- [x] Admin updates order status to "paid" (simulating payment) ✅ *Backend + UI complete*
- [x] Admin adjusts inventory levels ✅ *Backend + UI complete*
- [ ] User views order history - *Backend ready, UI pending*
- [ ] User views order details with status - *Backend ready, UI pending*

**Demo Flow**:
1. User browses products (Phase 2)
2. User sees discounted prices (Phase 3)
3. User adds items to cart
4. User proceeds to checkout
5. User selects/creates address
6. User places order (simulated payment)
7. Order created with status "pending"
8. Admin views order in dashboard
9. Admin marks order as "paid"
10. Admin updates status through processing → shipped → delivered
11. User sees status updates in app

---

## 11. Risk Mitigation

**Risk**: Inventory race conditions
**Mitigation**: Use `SELECT FOR UPDATE` row locking, test concurrent operations

**Risk**: Order creation fails partially
**Mitigation**: Wrap entire flow in transaction, test rollback scenarios

**Risk**: Cart data lost on app update
**Mitigation**: Use persistent storage (AsyncStorage), validate on checkout

**Risk**: Price changes between cart add and checkout
**Mitigation**: Re-compute prices at checkout time, show warning if changed

**Risk**: User confusion about simulated payment
**Mitigation**: Clear messaging throughout checkout and order status

---

## 12. Navigation Updates

### Mobile App Bottom Tabs

Update bottom tabs to include Cart:

**Current**:
- Shop
- Orders (requires auth)
- Pets (requires auth)
- Account

**Updated**:
- Shop
- Cart (with badge count)
- Orders (requires auth)
- Account

### Admin Sidebar

Add Orders and Inventory links:

**Updated Navigation**:
- Dashboard
- Products
- Discounts
- Families
- Tags
- **Orders** (new) ✅ *Implemented*
- **Inventory** (new) ✅ *Implemented*

---

## End of Phase 4 Plan

This plan provides a complete roadmap for implementing orders and checkout with simulated payment. The inventory system is transaction-safe and audit-logged. Future phases can add real payment integration without changing the core order flow.
