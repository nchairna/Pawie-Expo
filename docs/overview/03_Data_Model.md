# Doc 03 — Data Model & Row Level Security (RLS) Plan

Product: Pawie
Version: v2.0 (Chewy.com-Inspired Architecture)
Last Updated: 2026-01-09
Status: Source of Truth

---

## 1. Design Principles

- **Price Immutability**: Base price (`base_price_idr`) is immutable unless admin explicitly changes it
- **Discount Separation**: Discounts never overwrite base prices, stored separately
- **Server-Side Pricing**: Final price computed server-side at read/checkout time
- **Order Snapshots**: Orders store immutable price snapshot (base, discount, final) at creation
- **Autoship as Discount**: Autoship cheaper implemented as discount rule (not price override)
- **RLS Everywhere**: All application tables use Row Level Security
- **Family-Scoped Variants**: Variant dimensions belong to product families (not global)

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

### 4.1 product_families
Purpose:
- Group related products that share variant dimensions (e.g., "Royal Canin Adult Dog Food")
- Enables navigation between related products with different variant combinations

Columns:
- id (uuid, primary key)
- name (text, not null)
- description (text)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Public read allowed
- Admin full CRUD

Indexes:
- name

### 4.2 products
Purpose:
- Individual sellable products (each represents a specific variant combination)
- Example: "Royal Canin Adult - Lamb - 2lb bag" is one product
- Price and SKU stored directly on product (no separate variants table)

Columns:
- id (uuid, primary key)
- family_id (uuid, references product_families.id, nullable)
- name (text, not null)
- description (text)
- category (text, deprecated - use tags instead)
- base_price_idr (integer, not null) - **IMMUTABLE base price**
- sku (text, unique, nullable)
- published (boolean, default false)
- autoship_eligible (boolean, default true)
- primary_image_path (text, nullable) - path to primary product image
- searchable_text (tsvector, generated) - **GENERATED COLUMN** for full-text search
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Public read only if published = true
- Admin full CRUD

Indexes:
- name
- category (deprecated)
- published
- family_id
- sku (unique)
- base_price_idr
- searchable_text (GIN) - for full-text search
- published (partial, WHERE published = true) - for faster filtering
- name (GIN trigram) - for typo tolerance and fuzzy matching
- LOWER(name) (B-tree text_pattern_ops) - for prefix matching

Notes:
- Each product belongs to a family (family_id can be null for standalone products)
- Products in the same family share variant dimensions but have different variant value combinations
- Each product has its own `base_price_idr` and `sku` directly on the products table
- Base price is immutable (never modified by discounts)
- Category field is deprecated (use product_tags instead)
- `searchable_text` is a generated column (tsvector) combining name, description, and category for full-text search
- Search indexes enable fast prefix matching and typo tolerance

### 4.3 variant_dimensions
Purpose:
- Define variant dimensions for a product family (e.g., "Flavor", "Size")
- Used to build variant selector UI

Columns:
- id (uuid, primary key)
- family_id (uuid, references product_families.id, on delete cascade)
- name (text, not null) -- e.g., "Flavor", "Size"
- sort_order (integer, not null, default 0)
- created_at (timestamp)

RLS:
- Public read allowed
- Admin full CRUD

Indexes:
- family_id
- (family_id, sort_order)

Notes:
- Dimensions are scoped to a product family
- sort_order determines display order in UI

### 4.4 variant_values
Purpose:
- Define possible values for each dimension (e.g., "Lamb", "Chicken" for Flavor; "2lb", "4lb" for Size)

Columns:
- id (uuid, primary key)
- dimension_id (uuid, references variant_dimensions.id, on delete cascade)
- value (text, not null) -- e.g., "Lamb", "2lb bag"
- sort_order (integer, not null, default 0)
- created_at (timestamp)

RLS:
- Public read allowed
- Admin full CRUD

Indexes:
- dimension_id
- (dimension_id, sort_order)

Notes:
- Values are scoped to a dimension
- sort_order determines display order in UI

### 4.5 product_variant_values
Purpose:
- Link products to their variant values (many-to-many)
- Defines which variant combination each product represents

Columns:
- product_id (uuid, references products.id, on delete cascade)
- variant_value_id (uuid, references variant_values.id, on delete cascade)
- Primary key: (product_id, variant_value_id)

RLS:
- Public read if parent product is published
- Admin full CRUD

Indexes:
- product_id
- variant_value_id

Notes:
- A product must have exactly one value per dimension in its family
- Example: Product "Royal Canin Adult - Lamb - 2lb" links to:
  - Variant Value "Lamb" (from Flavor dimension)
  - Variant Value "2lb bag" (from Size dimension)

### 4.6 product_tags
Purpose:
- Multi-category support (e.g., "Dry Food", "Chicken", "Allergen Free")
- Products can have multiple tags

Columns:
- id (uuid, primary key)
- name (text, not null, unique)
- slug (text, not null, unique)
- created_at (timestamp)

RLS:
- Public read allowed
- Admin full CRUD

Indexes:
- name
- slug

### 4.8 product_tag_assignments
Purpose:
- Many-to-many relationship between products and tags

Columns:
- product_id (uuid, references products.id, on delete cascade)
- tag_id (uuid, references product_tags.id, on delete cascade)
- Primary key: (product_id, tag_id)

RLS:
- Public read if parent product is published
- Admin full CRUD

Indexes:
- product_id
- tag_id

### 4.9 Product Structure Summary

**Hierarchy:**
1. **Product Family** → Groups related products (e.g., "Royal Canin Adult Dog Food")
2. **Variant Dimensions** → Define variant types for a family (e.g., "Flavor", "Size")
3. **Variant Values** → Define possible values per dimension (e.g., "Lamb", "Chicken" for Flavor)
4. **Product** → Represents a specific combination (e.g., "Royal Canin Adult - Lamb - 2lb")
   - Each product has its own `base_price_idr` and `sku` directly on the products table
5. **Product Variant Values** → Links product to its variant values (many-to-many)
6. **Product Tags** → Multi-category support (e.g., "Dry Food", "Chicken", "Allergen Free")
7. **Product Images** → Multiple images per product with primary image support

**Example:**
- Family: "Royal Canin Adult Dog Food"
- Dimensions: "Flavor" (sort: 1), "Size" (sort: 2)
- Flavor Values: "Lamb", "Chicken", "Goat"
- Size Values: "2lb bag", "4lb bag", "6lb bag"
- Product 1: "Royal Canin Adult - Lamb - 2lb"
  - Links to: Flavor="Lamb", Size="2lb bag"
  - Tags: ["Dry Food", "Lamb"]
  - Price: 150000 IDR (stored in `base_price_idr` - IMMUTABLE)
  - SKU: "RC-ADULT-LAMB-2LB" (stored in `sku`)
  - Images: Multiple images with primary image
- Product 2: "Royal Canin Adult - Chicken - 4lb"
  - Links to: Flavor="Chicken", Size="4lb bag"
  - Tags: ["Dry Food", "Chicken", "Allergen Free"]
  - Price: 280000 IDR (stored in `base_price_idr` - IMMUTABLE)
  - SKU: "RC-ADULT-CHICKEN-4LB" (stored in `sku`)

**Key Points:**
- Not all combinations need to exist (sparse matrix support)
- Each product has its own images, price (`base_price_idr`), SKU (`sku`), and inventory
- Products can exist without families (standalone products)
- Variant dimensions are family-scoped, not global
- Tags are global and can be assigned to any product
- Price and SKU are stored directly on the products table (no separate variants table)
- Base price is immutable (discounts never modify it)

---

## 5. Inventory

### 5.1 inventory
Columns:
- id (uuid, primary key)
- product_id (uuid, references products.id, on delete cascade)
- stock_quantity (integer)
- updated_at (timestamp)

RLS:
- Admin full access
- No direct client writes

Indexes:
- product_id (unique)

### 5.2 inventory_movements
Purpose:
- Immutable audit log

Columns:
- id (uuid, primary key)
- product_id (uuid, references products.id, on delete restrict)
- change_quantity (integer)
- reason (text)
- reference_id (uuid)
- created_at (timestamp)

RLS:
- Admin only

Indexes:
- product_id (references products.id, on delete restrict)
- created_at

---

## 6. Discounts & Pricing Rules

Discounts are represented as rules and targets.
They do not modify base prices.

### 6.1 discounts
Purpose:
- Define discount rules (promo + autoship cheaper)
- Discounts never modify base prices, computed at runtime

Columns:
- id (uuid, primary key)
- name (text, not null)
- kind (text, values: 'promo', 'autoship') - autoship cheaper is kind='autoship'
- discount_type (text, values: 'percentage', 'fixed') - was 'percent', now 'percentage'
- value (integer, not null)
- active (boolean, default true)
- starts_at (timestamp, nullable)
- ends_at (timestamp, nullable)
- min_order_subtotal_idr (integer, nullable)
- stack_policy (text, values: 'best_only', 'stack') - was 'stack_with_autoship', now 'stack'
- usage_limit (integer, nullable) - max times discount can be used
- usage_count (integer, default 0) - current usage count
- created_at (timestamp)
- updated_at (timestamp)

Notes:
- For percentage: value is 0–100 (e.g., 10 = 10% off)
- For fixed: value is amount in IDR (e.g., 5000 = Rp 5,000 off)
- Autoship cheaper: kind='autoship', active=true, applies_to_all_products=true
- Stack policy: 'best_only' = take highest discount, 'stack' = combine discounts
- Discounts are time-bound (starts_at/ends_at) or always active (null)

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
- Attach discounts to products, categories, or all products
- Supports product-specific, category-wide, or site-wide discounts

Columns:
- id (uuid, primary key)
- discount_id (uuid, references discounts.id, on delete cascade)
- product_id (uuid, nullable, references products.id, on delete cascade)
- applies_to_all_products (boolean, default false) - for autoship discount
- created_at (timestamp)

Rules:
- Exactly one of: product_id set, OR applies_to_all_products=true
- Category targeting deprecated (use product_tags instead)
- Autoship discount: applies_to_all_products=true

RLS:
- Admin only

Indexes:
- discount_id
- product_id
- (discount_id, applies_to_all_products)

---

## 7. Orders

### 7.1 orders
Columns:
- id (uuid, primary key)
- user_id (uuid, references profiles.id, not null)
- status (text, not null) - CHECK: pending, paid, processing, shipped, delivered, cancelled, refunded
- source (text, not null) - CHECK: 'one_time', 'autoship'
- subtotal_idr (integer, not null) - sum of base prices
- discount_total_idr (integer, default 0) - total discount applied
- total_price_idr (integer, not null) - final total (subtotal - discount)
- shipping_address_id (uuid, references addresses.id, nullable)
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users read their own orders (user_id = auth.uid())
- Users can INSERT their own orders (user_id = auth.uid())
- Admin full access

Indexes:
- user_id
- status
- created_at
- source
- (user_id, status)

### 7.2 order_items
Purpose:
- Locks pricing at the time of order creation (immutable snapshot)

Columns:
- id (uuid, primary key)
- order_id (uuid, references orders.id, on delete cascade)
- product_id (uuid, references products.id, on delete restrict) - **NOT product_variant_id**
- quantity (integer, not null, CHECK quantity > 0)

Price snapshot columns (IMMUTABLE):
- unit_base_price_idr (integer, not null) - base price at order time
- unit_final_price_idr (integer, not null) - final price after discounts
- discount_total_idr (integer, default 0) - discount amount for this item
- discount_breakdown (jsonb) - detailed discount information

- created_at (timestamp)

RLS:
- Users read items for their own orders (via order.user_id)
- Admin full access

Indexes:
- order_id
- product_id
- (order_id, product_id)

Notes:
- Uses `product_id` directly (no separate variants table)
- Price snapshots are immutable (never change after order creation)
- discount_breakdown stores: [{ discount_id, name, type, value, amount }]

---

## 8. Autoship

### 8.1 autoships
Columns:
- id (uuid, primary key)
- user_id (uuid, references profiles.id, not null)
- pet_id (uuid, nullable, references pets.id, on delete set null)
- product_id (uuid, references products.id, on delete restrict) - **NOT product_variant_id**
- quantity (integer, not null, CHECK quantity > 0)
- frequency_weeks (integer, not null, CHECK frequency_weeks > 0) - e.g., 2 = every 2 weeks
- next_run_at (timestamp, not null) - when next order should be created
- status (text, not null) - CHECK: 'active', 'paused', 'cancelled'
- created_at (timestamp)
- updated_at (timestamp)

RLS:
- Users CRUD their own autoships (user_id = auth.uid())
- Admin read access

Indexes:
- user_id
- next_run_at (for scheduled execution)
- status
- (status, next_run_at) - for finding due autoships

Notes:
- Uses `product_id` directly (no separate variants table)
- Autoship receives discount automatically (kind='autoship')
- Status: active = running, paused = stopped but kept, cancelled = removed

### 8.2 autoship_runs
Purpose:
- Immutable audit log of autoship execution attempts
- Tracks success/failure for debugging and retry logic

Columns:
- id (uuid, primary key)
- autoship_id (uuid, references autoships.id, on delete cascade)
- scheduled_at (timestamp, not null) - when this run was scheduled
- executed_at (timestamp, nullable) - when execution completed
- status (text, not null) - CHECK: 'success', 'failed', 'pending'
- order_id (uuid, nullable, references orders.id) - created order if successful
- error_message (text, nullable) - error details if failed
- created_at (timestamp)

RLS:
- Admin full access
- Users read runs for their own autoships (via autoship.user_id)

Indexes:
- autoship_id
- scheduled_at
- status
- (autoship_id, scheduled_at) - for idempotency checks

Notes:
- Used for idempotency (prevent duplicate order creation)
- Failed runs can be retried
- Success runs should not be re-executed

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

### Pricing Flow

1. **Base Price**: Always from `products.base_price_idr` (immutable)
2. **Discount Selection**: Server-side function finds applicable discounts
3. **Autoship Discount**: Applies only when `order.source = 'autoship'`
4. **Stacking Policy**: 
   - `best_only`: Take highest discount
   - `stack`: Combine discounts (autoship + promo)
5. **Price Computation**: Server-side function computes final price
6. **Order Snapshot**: Orders store locked prices (base, discount, final)

### Key Rules

- Base price never modified by discounts
- Discounts computed at runtime (not stored on products)
- Orders store immutable price snapshots
- Historical orders never affected by future discount changes
- Autoship cheaper implemented as discount rule (kind='autoship')

---

## 11. Search & Filter Functions

### 11.1 Database Functions

**search_products(search_query, result_limit, result_offset)**
- Purpose: Full-text search for published products with prefix matching and typo tolerance
- Returns: Products matching search query, ordered by relevance
- Features:
  - Full-text search on name, description, category
  - Prefix matching ("roy" → "royal")
  - Typo tolerance ("royale" → "royal") using trigram similarity
  - Relevance ranking: Exact (3.0) > Prefix (2.0) > Typo (1.0)
  - Adaptive similarity thresholds based on query length
- Security: SECURITY DEFINER, respects RLS policies
- Permissions: Granted to authenticated and anon users

**filter_products_by_tags(tag_ids, result_limit, result_offset)**
- Purpose: Filter published products by tags (AND logic)
- Returns: Products that have ALL specified tags
- Features:
  - Multi-tag filtering with AND logic
  - Returns all published products if no tags provided
  - Supports pagination
- Security: SECURITY DEFINER, respects RLS policies
- Permissions: Granted to authenticated and anon users

### 11.2 Extensions

**pg_trgm**
- Purpose: PostgreSQL trigram extension for fuzzy string matching
- Used for: Typo tolerance in search (similarity matching)
- Version: 1.6

### 11.3 Search Indexes

- `products_searchable_text_idx` (GIN) - Full-text search on generated tsvector
- `products_published_idx` (B-tree, partial) - Fast filtering of published products
- `products_name_trgm_idx` (GIN trigram) - Typo tolerance and fuzzy matching
- `products_name_lower_idx` (B-tree text_pattern_ops) - Prefix matching with ILIKE

### 11.4 Search Features

**Full-Text Search**:
- Uses Postgres `tsvector` and `ts_rank` for relevance scoring
- Searches across name (weight A), description (weight B), category (weight C)
- Generated column `searchable_text` automatically updates when source columns change

**Prefix Matching**:
- Enables partial word matching ("roy" matches "royal")
- Uses ILIKE with indexed lowercased name for performance
- Medium relevance weight (2.0)

**Typo Tolerance**:
- Uses `pg_trgm` extension (in `extensions` schema) and `similarity()` function
- Adaptive thresholds: shorter queries (≤2 chars) = 0.4, medium (≤5) = 0.3, long (>5) = 0.25
- Lower relevance weight (1.0) to prioritize exact/prefix matches
- Extension moved to `extensions` schema (2026-01-09) following security best practices

**Tag Filtering**:
- Server-side filtering using `filter_products_by_tags()` function
- AND logic: products must have ALL selected tags
- Efficient with existing indexes on `product_tag_assignments`

---

## 12. Row Level Security (RLS) Optimizations

### 12.1 Performance Optimizations (Applied 2026-01-09)

All RLS policies have been optimized for performance and security:

**Auth Function Optimization**:
- All `auth.uid()` and `is_admin()` calls wrapped in `(select ...)` subqueries
- Auth functions now evaluate once per query instead of once per row
- **Impact**: 10-100x faster queries on large tables (>10,000 rows)
- **Affected**: 16 policies across 7 tables (profiles, pets, addresses, orders, order_items, autoships, autoship_runs)

**Policy Consolidation**:
- Multiple SELECT policies consolidated into single policies using OR conditions
- Separate policies for INSERT, UPDATE, DELETE (no overlap with SELECT)
- **Impact**: Reduced policy evaluation overhead
- **Affected**: 6 tables (product_families, variant_dimensions, variant_values, product_variant_values, product_tags, product_tag_assignments)

**Policy Structure**:
- SELECT policies: `_select` (public read + admin read combined)
- Write policies: `_admin_insert`, `_admin_update`, `_admin_delete` (separate per operation)
- No overlapping policies for the same role/action combination

### 12.2 Security Hardening (Applied 2026-01-09)

**Function Search Path**:
- All functions have `SET search_path = ''` to prevent SQL injection
- **Affected functions**: `is_admin()`, `handle_new_user()`, `find_applicable_discounts()`, `apply_discount_stacking()`, `compute_product_price()`
- **Impact**: Prevents search path manipulation attacks

**Extension Organization**:
- `pg_trgm` extension moved to `extensions` schema (security best practice)
- `search_products()` function updated to include `extensions` in search_path
- **Impact**: Follows PostgreSQL security best practices, cleaner schema organization

### 12.3 RLS Policy Patterns

**User-Owned Data** (profiles, pets, addresses, orders, autoships):
```sql
-- Pattern: Own data OR admin
USING (((select auth.uid()) = user_id) OR (select is_admin()))
```

**Public Read + Admin Write** (product_families, variant_dimensions, variant_values, product_tags):
```sql
-- SELECT: Public OR admin
CREATE POLICY "_select" FOR SELECT USING (true OR (select is_admin()));

-- Write: Admin only (separate policies per operation)
CREATE POLICY "_admin_insert" FOR INSERT ...;
CREATE POLICY "_admin_update" FOR UPDATE ...;
CREATE POLICY "_admin_delete" FOR DELETE ...;
```

**Conditional Public Read** (products, product_variant_values, product_tag_assignments):
```sql
-- SELECT: Published products OR admin
USING (
  (published = true) OR (select is_admin())
)
```

### 12.4 Migration History

**2026-01-09**: Applied 3 migrations fixing 34 warnings:
1. `20260109040911_fix_rls_performance_and_security_warnings.sql` - Main fixes
2. `20260109042552_move_pg_trgm_to_extensions_schema.sql` - Extension move
3. `20260109042932_fix_remaining_multiple_policies_warnings.sql` - Policy separation

**Result**: All database linter warnings resolved, production-ready security and performance.

---

## Next Document

Doc 04 — API & Data Flow Specification (Pricing, Discounts, Orders, Autoship)
