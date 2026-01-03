# Doc 03 — Data Model & Row Level Security (RLS) Plan

Product: Pawie
Version: v1.1 (Pricing + Discounts + Autoship Pricing)
Last Updated: 2026-01-03
Status: Source of Truth

---

## 1. Design Principles

- Base price is immutable per variant unless admin changes it explicitly
- Discounts never overwrite base prices
- Final price is computed at read/checkout time
- Orders store a price snapshot (base, discount, final) at creation time
- Autoship cheaper is implemented as a discount rule
- All application tables use RLS

---

## 2. Authentication & Profiles

### 2.1 auth.users
Managed by Supabase Auth.

### 2.2 profiles
Purpose:
- Application user profile
- Role-based access control

Columns:
- id (uuid, primary key, references auth.users.id)
- email (text)
- role (text, values: user, admin)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users can read/update their own profile
- Admin can read all profiles

---

## 3. Pets

### 3.1 pets
Columns:
- id (uuid, primary key)
- user_id (uuid, references profiles.id)
- name (text)
- species (text)
- breed (text)
- age (integer)
- weight (numeric)
- activity_level (text)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users CRUD their own pets
- Admin read all pets

Indexes:
- user_id

---

## 4. Products & Variants

### 4.1 products
Columns:
- id (uuid, primary key)
- name (text)
- description (text)
- category (text)
- published (boolean)
- autoship_eligible (boolean)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Public read only if published = true
- Admin full CRUD

Indexes:
- name
- category
- published

### 4.2 product_variants
Purpose:
- Variations (size, flavor, etc.)
- Base pricing lives here

Columns:
- id (uuid, primary key)
- product_id (uuid, references products.id)
- name (text)
- sku (text, unique)
- base_price_idr (integer)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Public read if parent product is published
- Admin full CRUD

Indexes:
- product_id
- sku

---

## 5. Inventory

### 5.1 inventory
Columns:
- id (uuid, primary key)
- product_variant_id (uuid, references product_variants.id)
- stock_quantity (integer)
- updated_at (timestamp)

RLS:
- Admin full access
- No direct client writes

Indexes:
- product_variant_id

### 5.2 inventory_movements
Purpose:
- Immutable audit log

Columns:
- id (uuid, primary key)
- product_variant_id (uuid)
- change_quantity (integer)
- reason (text)
- reference_id (uuid)
- created_at (timestamp)

RLS:
- Admin only

Indexes:
- product_variant_id
- created_at

---

## 6. Discounts & Pricing Rules

Discounts are represented as rules and targets.
They do not modify base prices.

### 6.1 discounts
Purpose:
- Define discount rules (promo + autoship cheaper)

Columns:
- id (uuid, primary key)
- name (text)
- kind (text, values: promo, autoship)
- discount_type (text, values: percent, fixed)
- value (integer)
- active (boolean)
- starts_at (timestamp, nullable)
- ends_at (timestamp, nullable)
- min_order_subtotal_idr (integer, nullable)
- stack_policy (text, values: best_only, stack_with_autoship)
- created_at (timestamp)
- updated_at (timestamp)

Notes:
- For percent: value is 0–100
- For fixed: value is amount in IDR
- Autoship cheaper can be a discount row with kind = autoship, active = true

RLS:
- Public read not allowed
- Users do not read discount definitions directly (optional)
- Admin full CRUD

Indexes:
- active
- starts_at
- ends_at
- kind

### 6.2 discount_targets
Purpose:
- Attach discounts to products/variants/categories

Columns:
- id (uuid, primary key)
- discount_id (uuid, references discounts.id)
- product_id (uuid, nullable)
- product_variant_id (uuid, nullable)
- category (text, nullable)
- created_at (timestamp)

Rules:
- At least one of product_id, product_variant_id, category must be set

RLS:
- Admin only

Indexes:
- discount_id
- product_id
- product_variant_id
- category

---

## 7. Orders

### 7.1 orders
Columns:
- id (uuid, primary key)
- user_id (uuid, references profiles.id)
- status (text)
- source (text, values: one_time, autoship)
- subtotal_idr (integer)
- discount_total_idr (integer)
- total_idr (integer)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users read their own orders
- Admin full access

Indexes:
- user_id
- status
- created_at
- source

### 7.2 order_items
Purpose:
- Locks pricing at the time of order creation

Columns:
- id (uuid, primary key)
- order_id (uuid, references orders.id)
- product_variant_id (uuid)
- quantity (integer)

Price snapshot columns:
- unit_base_price_idr (integer)
- unit_final_price_idr (integer)
- discount_total_idr (integer)
- discount_breakdown (jsonb)

- created_at (timestamp)

RLS:
- Users read items for their own orders
- Admin full access

Indexes:
- order_id
- product_variant_id

---

## 8. Autoship

### 8.1 autoships
Columns:
- id (uuid, primary key)
- user_id (uuid)
- pet_id (uuid, nullable)
- product_variant_id (uuid)
- quantity (integer)
- frequency_weeks (integer)
- next_run_at (timestamp)
- status (text, values: active, paused, cancelled)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users CRUD their own autoships
- Admin read access

Indexes:
- user_id
- next_run_at
- status

### 8.2 autoship_runs
Columns:
- id (uuid, primary key)
- autoship_id (uuid)
- scheduled_at (timestamp)
- executed_at (timestamp)
- status (text, values: success, failed)
- order_id (uuid, nullable)
- error_message (text)
- created_at (timestamp)

RLS:
- Admin full access
- Users read runs for their own autoships

Indexes:
- autoship_id
- scheduled_at
- status

---

## 9. Addresses

### 9.1 addresses
Columns:
- id (uuid, primary key)
- user_id (uuid)
- label (text)
- address_line (text)
- city (text)
- province (text)
- postal_code (text)
- created_at (timestamp)

RLS:
- Users CRUD their own addresses
- Admin read access

Indexes:
- user_id

---

## 10. Pricing Rules (Operational)

- Base price is taken from product_variants.base_price_idr
- Applicable discounts are selected server-side
- Autoship cheaper discount applies only when order.source = autoship
- Orders and order_items store final locked prices

---

## Next Document

Doc 04 — API & Data Flow Specification (Pricing, Discounts, Orders, Autoship)
