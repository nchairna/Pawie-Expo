# Doc 05 — Admin App Specification

Product: Pawie  
Version: v1.0  
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

## 6. Products Module

Purpose:
- Manage product catalog

Capabilities:
- Create product
- Edit product
- Publish / unpublish product
- Assign category
- Toggle autoship eligibility

Product fields editable:
- Name
- Description
- Category
- Published status
- Autoship eligible flag

Restrictions:
- Deleting products should be soft-delete or disabled once ordered

---

## 7. Product Variants Module

Purpose:
- Manage variant-level pricing and SKUs

Capabilities:
- Create variant
- Edit variant
- Set base price (IDR)
- Manage SKU
- View inventory status

Rules:
- Base price is edited only here
- Admin must never edit final or discounted prices directly

---

## 8. Pricing & Discounts Module

Purpose:
- Manage all discount logic including autoship cheaper pricing

Capabilities:
- Create discount rules
- Activate / deactivate discounts
- Define discount type (percent or fixed)
- Define discount scope:
  - Product
  - Variant
  - Category
- Define discount time window
- Define stacking rules
- Create autoship cheaper discount (kind = autoship)

Admin visibility:
- View discount usage
- Preview effective prices per variant
- Preview autoship vs one-time pricing

Restrictions:
- Discounts must never overwrite base prices
- Editing discounts must not affect historical orders

---

## 9. Inventory Module

Purpose:
- Maintain accurate stock levels and audit history

Capabilities:
- View inventory per variant
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

## 10. Orders Module

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

## 11. Autoships Module

Purpose:
- Monitor recurring orders and future demand

Capabilities:
- View all autoships
- Filter by status (active, paused, cancelled)
- View next run date
- View linked pet and product
- View autoship execution history

Admin actions:
- Pause autoship (optional)
- Cancel autoship (optional)

Restrictions:
- Admin must not manually create autoship orders
- Autoship execution handled server-side only

---

## 12. Customers Module

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

## 13. Settings Module (Minimal)

Purpose:
- System-level configuration

Capabilities (MVP):
- View environment info
- View admin users
- View system health indicators

---

## 14. Non-Functional Requirements

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

## 15. MVP Definition of Done

Admin App MVP is complete when:
- Admin can manage products and variants
- Admin can manage discounts including autoship cheaper
- Admin can manage inventory safely
- Admin can view and process orders
- Admin can monitor autoships
- No admin action can corrupt pricing or inventory

---

## Next Document

Doc 06 — Environment Setup & Execution Plan
