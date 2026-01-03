# Doc 04 — API & Data Flow Specification

Product: Pawie
Version: v1.0
Last Updated: 2026-01-03
Status: Source of Truth

---

## 1. Principles

- Clients do not decide pricing
- Pricing is computed server-side for consistency
- Order creation locks a price snapshot
- Autoship runs use the same pricing function as checkout

---

## 2. Recommended API Pattern

Use Supabase Postgres Functions (RPC) for core flows:

- get_product_price_quote
- create_order_from_cart
- run_autoships_due

These functions can be called from:
- Mobile app
- Admin app (if needed)
- Edge Function (for scheduled autoships)

---

## 3. Price Quote Flow

Goal:
- Return the final price for a variant given context

Context includes:
- is_autoship
- user_id (optional, for eligibility rules later)
- quantity

Inputs:
- product_variant_id
- quantity
- is_autoship (boolean)

Outputs:
- unit_base_price_idr
- unit_final_price_idr
- discount_total_idr
- discount_breakdown
- line_total_idr

Rules:
- Select applicable discounts (active + within time window)
- Apply autoship cheaper rule if is_autoship = true
- Apply promo discount based on stack_policy
- Ensure final price is never negative

---

## 4. Create One-Time Order Flow

Inputs:
- cart items (variant_id, quantity)
- address_id

Server steps:
- Validate user auth
- Validate all variants exist and products are published
- Validate inventory availability
- For each item, call pricing logic
- Insert orders row with subtotal, discount_total, total
- Insert order_items with price snapshot
- Decrement inventory and write inventory_movements
- Return order_id

Output:
- order_id
- totals
- status

---

## 5. Create Autoship Flow

Inputs:
- product_variant_id
- quantity
- frequency_weeks
- pet_id (optional)
- next_run_at

Server steps:
- Validate user auth
- Validate product autoship eligibility
- Insert autoships row

Output:
- autoship_id
- next_run_at

---

## 6. Autoship Execution Flow (Scheduled)

Trigger:
- Scheduler calls server endpoint (Edge Function) OR calls RPC directly in a trusted environment

Server steps:
- Find autoships where status = active and next_run_at <= now
- For each autoship:
  - Check idempotency using autoship_runs for scheduled_at window
  - Validate inventory
  - Create order with source = autoship
  - Apply pricing with is_autoship = true
  - Insert autoship_runs record
  - Update autoships.next_run_at to the next scheduled time

Failure handling:
- Record autoship_runs.status = failed and error_message
- Do not create partial orders
- Do not decrement inventory if order creation fails

---

## 7. Discount Management (Admin)

Admin operations:
- Create/activate/deactivate discounts
- Attach discount_targets to product, variant, or category
- Define autoship cheaper rule as a discount with kind = autoship

Safety rules:
- Discount changes affect future quotes and future orders
- Past orders remain accurate due to locked snapshots

---

## 8. Data Returned to Clients

Mobile:
- Product list: base price and computed effective price (from quote endpoint or view)
- Checkout: quote results per line item
- Orders: locked order totals and item snapshots

Admin:
- Catalog: base prices
- Pricing preview: computed quote for a variant context
- Orders: locked snapshots and discount breakdown

---

## Next Document

Doc 05 — Admin App Specification
