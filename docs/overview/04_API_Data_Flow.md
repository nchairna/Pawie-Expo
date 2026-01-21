# Doc 04 — API & Data Flow Specification

Product: Pawie
Version: v2.0 (Chewy.com-Inspired Architecture)
Last Updated: 2026-01-17
Status: Source of Truth

---

## 1. Principles

- **Server-Side Pricing**: Clients never compute prices, all pricing server-side
- **Price Immutability**: Base prices never modified, discounts computed at runtime
- **Order Snapshots**: Order creation locks immutable price snapshot
- **Consistent Pricing**: Autoship uses same pricing function as checkout
- **Transaction Safety**: Inventory and orders use ACID transactions

---

## 2. Recommended API Pattern

Use Supabase Postgres Functions (RPC) and Edge Functions for core flows:

**Postgres Functions (RPC)**:
- `compute_product_price()` - Compute price with discounts
- `create_order_with_inventory()` - Create order with inventory validation
- `check_product_availability()` - Check inventory availability

**Edge Functions**:
- `create-order` - Order creation endpoint (calls RPC functions)
- `run-autoships` - Scheduled autoship execution
- `compute-cart-price` - Cart pricing computation

**Calling Pattern**:
- Mobile app → Edge Function → Postgres RPC
- Admin app → Edge Function → Postgres RPC
- Scheduled jobs → Edge Function → Postgres RPC

---

## 3. Price Quote Flow

**Goal**: Return the final price for a product given context

**Function**: `compute_product_price(product_id, user_id, is_autoship, quantity, cart_total, coupon_code)`

**Inputs**:
- `product_id` (uuid) - Product to price
- `user_id` (uuid, nullable) - For user-specific discounts (future)
- `is_autoship` (boolean) - Whether this is an autoship order
- `quantity` (integer) - Quantity being purchased
- `cart_total` (integer, nullable) - Total cart value (for min_order_subtotal)
- `coupon_code` (text, nullable) - Coupon code (future)

**Outputs**:
- `base_price_idr` (integer) - Base price from products table
- `final_price_idr` (integer) - Final price after discounts
- `discount_total_idr` (integer) - Total discount amount
- `discounts_applied` (jsonb) - Array of applied discounts
- `line_total_idr` (integer) - Final price × quantity

**Rules**:
1. Get base price from `products.base_price_idr`
2. Find applicable discounts (active + within time window + targets match)
3. If `is_autoship = true`, include autoship discount (kind='autoship')
4. Apply stacking policy (`best_only` or `stack`)
5. Ensure final price is never negative
6. Return price breakdown

**Example Response**:
```json
{
  "base_price_idr": 250000,
  "final_price_idr": 225000,
  "discount_total_idr": 25000,
  "discounts_applied": [
    {
      "discount_id": "abc-123",
      "name": "Autoship 10% Off",
      "type": "percentage",
      "value": 10,
      "amount": 25000
    }
  ],
  "line_total_idr": 225000
}
```

---

## 4. Create Order Flow (One-Time & Autoship)

**Function**: `create_order_with_inventory(user_id, items, address_id, source)`

**Inputs**:
- `user_id` (uuid) - Authenticated user
- `items` (jsonb) - `[{ product_id, quantity }, ...]`
- `address_id` (uuid, nullable) - Shipping address
- `source` (text) - `'one_time'` or `'autoship'`

**Note**: In the checkout flow, autoship is handled **per-product** in the cart. Each product can be individually selected for autoship enrollment, and the checkout process separates items into:
- **One-time items**: Regular order items (source = 'one_time')
- **Autoship items**: Items that create both an immediate order and an autoship subscription (source = 'autoship')

**Server Steps** (Transaction-Safe):
1. Validate user authentication
2. Validate all products exist and are published
3. Validate inventory availability for all items
4. For each item:
   - Call `compute_product_price()` with `is_autoship = (source = 'autoship')`
   - Store price snapshot
5. Insert `orders` row with totals
6. Insert `order_items` with price snapshots (using `product_id`)
7. Decrement inventory (transaction-safe, prevents negative)
8. Write `inventory_movements` audit log
9. Return order confirmation

**Output**:
```json
{
  "order_id": "uuid",
  "status": "pending",
  "subtotal_idr": 500000,
  "discount_total_idr": 50000,
  "total_price_idr": 450000,
  "items": [...]
}
```

**Error Handling**:
- `INSUFFICIENT_INVENTORY` - Product out of stock
- `PRODUCT_NOT_FOUND` - Product doesn't exist or not published
- `INVALID_USER` - User not authenticated

---

## 4.1 Cart Checkout Flow (Per-Product Autoship)

**Implementation**: The checkout flow supports **per-product autoship selection** (Chewy-style), where each product in the cart can be individually enrolled in autoship.

**Flow Steps**:

1. **Cart Review**:
   - User views cart items with pricing
   - For each autoship-eligible product, user can toggle "Subscribe & Save"
   - User selects delivery frequency per product (1-24 weeks)
   - Pricing updates in real-time showing autoship savings

2. **Item Separation**:
   - Cart items are separated into two groups:
     - **One-time items**: Products not selected for autoship
     - **Autoship items**: Products selected for autoship enrollment

3. **Order Creation**:
   - **One-time items**: Create order via `create_order_with_inventory()` with `source = 'one_time'`
   - **Autoship items**: For each autoship item:
     - Create autoship subscription via `create_autoship_with_order()`
     - This function creates both:
       - An immediate order (source = 'autoship') with autoship discount applied
       - An autoship subscription record for future deliveries

4. **Pricing**:
   - Each product's pricing is computed individually using `compute_product_price()`
   - Autoship items use `is_autoship = true` to apply autoship discounts
   - One-time items use `is_autoship = false`

5. **Confirmation**:
   - User sees confirmation for:
     - One-time order (if any)
     - Autoship subscriptions created (with next delivery dates)

**Key Points**:
- Autoship selection is **per-product**, not per-order
- Mixed carts are supported (some items autoship, some one-time)
- Each autoship item creates its own subscription with individual frequency
- Autoship discounts apply automatically to autoship items
- Cart is cleared after successful checkout

---

## 5. Create Autoship Flow

**Function**: `create_autoship(user_id, product_id, quantity, frequency_weeks, pet_id, next_run_at)`

**Inputs**:
- `user_id` (uuid) - Authenticated user
- `product_id` (uuid) - Product to autoship
- `quantity` (integer) - Quantity per delivery
- `frequency_weeks` (integer) - Delivery frequency (2, 4, 8 weeks)
- `pet_id` (uuid, nullable) - Linked pet profile
- `next_run_at` (timestamp) - First delivery date

**Server Steps**:
1. Validate user authentication
2. Validate product exists and `autoship_eligible = true`
3. Validate inventory availability (optional check)
4. Insert `autoships` row with status='active'
5. Return autoship confirmation

**Output**:
```json
{
  "autoship_id": "uuid",
  "next_run_at": "2026-01-15T00:00:00Z",
  "status": "active",
  "estimated_savings": "10% off every order"
}
```

**Rules**:
- Autoship receives discount automatically (kind='autoship')
- Next run date must be in the future
- Frequency must be positive integer

---

## 6. Autoship Execution Flow (Scheduled)

**Trigger**: Scheduled job (cron) calls Edge Function `run-autoships` every hour

**Edge Function**: `supabase/functions/run-autoships/index.ts`

**Server Steps** (Idempotent):
1. Find autoships where `status = 'active'` and `next_run_at <= NOW()`
2. For each autoship:
   - **Idempotency Check**: Query `autoship_runs` for `scheduled_at` window (prevent duplicates)
   - **Validate Inventory**: Check `check_product_availability(product_id, quantity)`
   - **Create Order**: Call `create_order_with_inventory()` with `source = 'autoship'`
     - Pricing automatically includes autoship discount (is_autoship=true)
   - **Log Execution**: Insert `autoship_runs` record with status='success' and order_id
   - **Update Next Run**: Set `autoships.next_run_at = next_run_at + frequency_weeks`
3. Send email confirmations for successful orders

**Failure Handling**:
- Record `autoship_runs.status = 'failed'` with `error_message`
- Do not create partial orders (transaction rollback)
- Do not decrement inventory if order creation fails
- Retry logic: Failed autoships can be retried manually or automatically

**Idempotency**:
- Check `autoship_runs` for existing record with same `scheduled_at`
- If exists and status='success', skip execution
- Prevents duplicate order creation on retries

---

## 7. Discount Management (Admin)

**Admin Operations**:
- Create/activate/deactivate discounts
- Attach `discount_targets` to products or set `applies_to_all_products=true`
- Define autoship cheaper rule: `kind='autoship'`, `applies_to_all_products=true`
- Set stacking policy (`best_only` or `stack`)
- Set time windows (`starts_at`, `ends_at`)
- Set usage limits (`usage_limit`, `usage_count`)

**Safety Rules**:
- Discount changes affect **future quotes and future orders only**
- Past orders remain accurate due to locked price snapshots
- Base prices never modified by discounts
- Discounts can be deactivated without affecting historical orders

**Autoship Discount Setup**:
```sql
-- Create autoship discount
INSERT INTO discounts (name, kind, discount_type, value, active, stack_policy)
VALUES ('Autoship 10% Off', 'autoship', 'percentage', 10, true, 'stack');

-- Apply to all products
INSERT INTO discount_targets (discount_id, applies_to_all_products)
VALUES (discount_id, true);
```

---

## 8. Product Family & Variant Navigation Flow (Chewy-Style)

**Goal**: Enable Chewy-style variant selector UI with instant navigation

### 8.1 Get Product Family Variants

**Function**: `get_product_family_variants(product_id)`

**Purpose**: Return available variant dimensions and values for building variant selector UI

**Inputs**:
- `product_id` (uuid) - Current product

**Outputs**:
```json
{
  "family_id": "uuid",
  "family_name": "Royal Canin Adult Dog Food",
  "dimensions": [
    {
      "dimension_id": "uuid",
      "name": "Flavor",
      "sort_order": 1,
      "values": [
        { "value_id": "uuid", "value": "Lamb", "available": true },
        { "value_id": "uuid", "value": "Chicken", "available": true },
        { "value_id": "uuid", "value": "Goat", "available": false }
      ]
    },
    {
      "dimension_id": "uuid",
      "name": "Size",
      "sort_order": 2,
      "values": [...]
    }
  ],
  "current_product": {
    "product_id": "uuid",
    "variant_values": [
      { "dimension": "Flavor", "value": "Lamb" },
      { "dimension": "Size", "value": "2lb bag" }
    ]
  }
}
```

**Rules**:
- Only return dimensions/values that exist for products in the family
- Mark values as "available" if a published product exists with that combination
- Sort by `dimension.sort_order`, then `value.sort_order`
- If product not in family, return empty dimensions

### 8.2 Find Product by Variant Combination

**Function**: `find_product_by_variants(family_id, variant_value_ids[])`

**Purpose**: Navigate to different product in same family when user clicks variant selector

**Inputs**:
- `family_id` (uuid) - Product family
- `variant_value_ids` (uuid[]) - Selected variant values

**Outputs**:
```json
{
  "product_id": "uuid",
  "found": true,
  "product": {
    "id": "uuid",
    "name": "Royal Canin Adult - Chicken - 4lb",
    "base_price_idr": 280000,
    "sku": "RC-ADULT-CHICKEN-4LB",
    "primary_image_path": "path/to/image.jpg"
  }
}
```

**Rules**:
- Find product in family with exact variant value combination
- Only return published products
- If not found, return `found: false` (UI shows "Unavailable")
- Used for instant variant navigation (Chewy-style)

### 8.3 Get Related Products (Family Members)

**Function**: `get_related_products(product_id)`

**Purpose**: Show related products in same family for "View other sizes/flavors" navigation

**Inputs**:
- `product_id` (uuid) - Current product

**Outputs**:
```json
{
  "family_id": "uuid",
  "family_name": "Royal Canin Adult Dog Food",
  "related_products": [
    {
      "product_id": "uuid",
      "name": "Royal Canin Adult - Lamb - 4lb",
      "variant_values": [
        { "dimension": "Flavor", "value": "Lamb" },
        { "dimension": "Size", "value": "4lb bag" }
      ],
      "primary_image_path": "path/to/image.jpg",
      "base_price_idr": 280000,
      "sku": "RC-ADULT-LAMB-4LB"
    },
    ...
  ]
}
```

**Rules**:
- Return all published products in the same family
- Exclude current product
- Include variant value information for display
- Sort by variant values (consistent ordering)

---

## 9. Data Returned to Clients

### Mobile App

**Product List**:
- Base price (`base_price_idr`)
- Computed effective price (from `compute_product_price()`)
- Discount badge if applicable
- Autoship savings indicator

**Product Detail**:
- Variant dimensions and available values
- Related products in same family
- Price breakdown (base, discount, final)
- Autoship enrollment option with savings
- SKU and inventory status

**Variant Selector**:
- Dimensions and values for current family
- Available/unavailable indicators
- Instant navigation to other variants

**Checkout**:
- Price quote results per line item
- Per-product autoship selection (Chewy-style)
- Individual frequency selection per product
- Total breakdown (subtotal, discounts, final)
- Mixed cart support (some items autoship, some one-time)

**Orders**:
- Locked order totals and item snapshots
- Immutable price breakdown
- Order status and tracking

### Admin App

**Catalog**:
- Base prices on products (`base_price_idr`)
- Family relationships and variant dimensions
- Product tag assignments

**Product Family Management**:
- Dimensions, values, product assignments
- Variant navigation preview

**Product Management**:
- Price and SKU set directly on product
- Variant value assignments
- Tag assignments

**Pricing Preview**:
- Computed quote for product context
- One-time vs autoship pricing comparison
- Discount breakdown

**Orders**:
- Locked price snapshots
- Discount breakdown per item
- Order status and history

---

## Next Document

Doc 05 — Admin App Specification
