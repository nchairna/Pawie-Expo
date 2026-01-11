# Doc 05 — Admin App Specification

Product: Pawie  
Version: v1.1 (Product Families + Variant Dimensions)  
Last Updated: 2026-01-03  
Status: Source of Truth

---

## 1. Purpose of Admin App

The Admin App is an internal operational tool used to:

- Manage products and pricing
- Control discounts and autoship cheaper rules
- Maintain inventory accuracy
- Process and monitor orders
- Monitor autoships and future demand
- Ensure operational correctness and auditability

The Admin App is NOT customer-facing.

---

## 2. Admin Users & Roles

### 2.1 Roles

- admin (initially only one role)

Future roles may include:
- ops
- support
- finance

Role is stored on the profiles table.

---

## 3. Authentication & Access

- Admin users authenticate via Supabase Auth (email + password)
- Admin access is enforced by Row Level Security
- Non-admin users must never access admin routes or data
- Admin app must not rely on client-side role checks alone

---

## 4. Core Admin Modules

The Admin App consists of the following core modules:

- Dashboard
- Products
- Pricing & Discounts
- Inventory
- Orders
- Autoships
- Customers
- Settings (minimal)

---

## 5. Dashboard

Purpose:
- Provide high-level operational visibility

Key metrics:
- Total orders (lifetime / recent)
- Orders by status
- Active autoships
- Upcoming autoship executions
- Low inventory alerts

Requirements:
- Read-only metrics
- No destructive actions on dashboard

---

## 6. Product Families Module

Purpose:
- Manage product families (groups of related products with shared variant dimensions)

Capabilities:
- Create product family
- Edit family name and description
- Define variant dimensions for family (e.g., "Flavor", "Size")
- Define variant values for each dimension (e.g., "Lamb", "Chicken" for Flavor)
- View all products in a family
- Delete family (with cascade handling)

Family fields editable:
- Name
- Description

Variant Dimension management:
- Add dimension (name, sort_order)
- Edit dimension name and sort order
- Delete dimension (cascade to values and product assignments)

Variant Value management:
- Add value to dimension (value text, sort_order)
- Edit value text and sort order
- Delete value (cascade to product assignments)

Restrictions:
- Dimensions and values cannot be deleted if products are assigned
- Family deletion requires confirmation and handles product reassignment

---

## 7. Products Module

Purpose:
- Manage individual products (each represents a specific variant combination)

Capabilities:
- Create product
- Assign product to family (optional)
- Assign variant values to product (one per dimension in family)
- Edit product
- Publish / unpublish product
- Assign tags (multi-category)
- Toggle autoship eligibility

Product fields editable:
- Name
- Description
- Category (legacy, consider using tags instead)
- Family assignment
- Variant value assignments (for products in families)
- Base Price (IDR) - stored directly on product
- SKU - stored directly on product
- Tag assignments (many-to-many)
- Published status
- Autoship eligible flag

Variant Value Assignment:
- For products in a family, must assign exactly one value per dimension
- UI shows dimension selectors with available values
- Validation ensures all dimensions are assigned

Tag Assignment:
- Multi-select interface for tags
- Can assign multiple tags per product
- Tags can be created on-the-fly or selected from existing

Restrictions:
- Deleting products should be soft-delete or disabled once ordered
- Products in families must have variant values assigned for all dimensions
- Cannot remove variant value assignment if it's the only one for that dimension
- Products in families must have price and SKU set
- Price and SKU are required for family-based products

---

## 8. Product Tags Module

Purpose:
- Manage product tags for multi-category support

Capabilities:
- Create tag (name, slug)
- Edit tag
- Delete tag (with cascade handling)
- View all products with a tag
- Bulk assign tags to products

Tag fields editable:
- Name
- Slug (auto-generated from name, editable)

Restrictions:
- Tag deletion removes assignments but doesn't delete products
- Slug must be unique

---

## 9. Pricing & Discounts Module

Purpose:
- Manage all discount logic including autoship cheaper pricing

Capabilities:
- Create discount rules
- Activate / deactivate discounts
- Define discount type (percent or fixed)
- Define discount scope:
  - Product
  - Category
- Define discount time window
- Define stacking rules
- Create autoship cheaper discount (kind = autoship)

Admin visibility:
- View discount usage
- Preview effective prices per product
- Preview autoship vs one-time pricing

Restrictions:
- Discounts must never overwrite base prices
- Editing discounts must not affect historical orders

---

## 10. Inventory Module

Purpose:
- Maintain accurate stock levels and audit history

Capabilities:
- View inventory per product
- Manually adjust inventory
- View inventory movement history
- See autoship-related demand indicators

Inventory adjustments require:
- Reason field
- Immutable movement log entry

Rules:
- Inventory must never go negative
- Inventory updates must be transaction-safe

---

## 11. Orders Module

Purpose:
- Process and monitor customer orders

Capabilities:
- View all orders
- Filter by status
- View order details
- Update order status
- View price breakdown per order item
- View autoship vs one-time source

Order details must include:
- Base price snapshot
- Discount breakdown
- Final price snapshot

Restrictions:
- Order prices are read-only
- Orders must not be edited after creation
- Status changes must be logged

---

## 12. Autoships Module

Purpose:
- Monitor recurring orders and future demand

Capabilities:
- View all autoships
- Filter by status (active, paused, cancelled)
- View next run date
- View linked pet and product (product_id, not variant_id)
- View autoship execution history

Admin actions:
- Pause autoship (optional)
- Cancel autoship (optional)

Restrictions:
- Admin must not manually create autoship orders
- Autoship execution handled server-side only

---

## 13. Customers Module

Purpose:
- Customer support and visibility

Capabilities:
- View customer list
- View customer profile
- View customer pets
- View customer orders
- View customer autoships

Restrictions:
- Admin must not edit customer pets or personal data directly (MVP)

---

## 14. Settings Module (Minimal)

Purpose:
- System-level configuration

Capabilities (MVP):
- View environment info
- View admin users
- View system health indicators

---

## 16. Non-Functional Requirements

Security:
- RLS enforced on all reads and writes
- Admin role validated server-side
- No service-role keys in client bundles

Reliability:
- All destructive actions confirmed
- All state changes logged
- Autoship and pricing logic not duplicated in admin

Usability:
- Fast page loads
- Clear separation between read-only and write actions
- Explicit warnings for irreversible actions

---

## 17. MVP Definition of Done

Admin App MVP is complete when:
- Admin can manage product families with variant dimensions
- Admin can manage products and assign variant values
- Admin can set price and SKU directly on products
- Admin can manage product tags (multi-category)
- Admin can manage discounts including autoship cheaper
- Admin can manage inventory safely (per product)
- Admin can view and process orders
- Admin can monitor autoships
- No admin action can corrupt pricing or inventory

---

## Next Document

Doc 06 — Environment Setup & Execution Plan
