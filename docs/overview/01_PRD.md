# Doc 01 — Product Requirements Document (PRD)

Product: Pawie
Version: v2.0 (Chewy.com-Inspired Architecture)
Last Updated: 2026-01-17
Status: Source of Truth

---

## 1. Product Overview

Pawie is a pet product e-commerce platform inspired by Chewy.com's industry-leading features, built for the Indonesian market. We aim to replicate Chewy's best-in-class user experience while adapting to local market needs.

### Core Business Model

- **Single Seller Model**: Pawie operates as the sole merchant (like Chewy.com)
- **Pet-First Experience**: Product recommendations based on pet profiles
- **Autoship Subscription**: Recurring deliveries with automatic discounts (Chewy's killer feature)
- **Family Variant Navigation**: Intelligent product variant selector (Chewy-style UI)
- **Always-On Discounts**: Tiered pricing, autoship savings, promotional campaigns

### Core Value Propositions

- **Convenience**: Autoship subscriptions with automatic discounts
- **Trust**: Accurate pricing, inventory transparency, immutable order history
- **Personalization**: Pet-based product recommendations
- **Transparency**: Clear pricing breakdowns, no hidden fees

---

## 2. Product Goals

### Primary Goals

- **Chewy.com Feature Parity**: Replicate core Chewy features (autoship, variant navigation, discounts)
- **Production-Ready**: Secure, scalable, maintainable from day one
- **Price Integrity**: Immutable price snapshots, transparent discount application
- **Autoship First**: Autoship cheaper pricing as core differentiator
- **Pet-Centric**: Product recommendations based on pet profiles

### Non-Goals (MVP)

- No ML-based pricing or recommendations
- No loyalty points or cashback programs
- No COD (Cash on Delivery)
- No multi-vendor marketplace
- No reviews/ratings (Phase 4+)
- No advanced search (basic Postgres search for MVP)

---

## 3. Target Users

### Customer (Mobile App)
- Indonesian pet owners
- Repeat buyers of pet consumables (food, treats, supplies)
- Value convenience and automation
- Want predictable pricing and savings
- Prefer mobile-first shopping experience

### Admin (Web App)
- Internal operations team
- Manages product catalog, pricing, inventory, and orders
- Controls autoship eligibility and discount rules
- Monitors autoship execution and demand forecasting

---

## 4. Platforms & Tech Assumptions

Mobile App:
- Expo (React Native)

Admin App:
- Next.js

Backend:
- Supabase Auth (email + password)
- Supabase Postgres with RLS
- Supabase Storage
- Server-side functions for pricing and autoship execution

UI:
- shadcn-inspired design
- Clean, minimal, trust-first

---

## 5. App Navigation (Customer)

Bottom tabs:
- Shop
- Orders
- Pets
- Account

Autoship and discounts appear contextually, not as standalone pages.

---

## 6. Customer Features

### 6.1 Shop (Chewy-Style)

Features:
- Product browsing with family-based variant navigation
- Fast search (Postgres-based for MVP)
- Product detail pages with:
  - Variant selector
  - Product detail sections (accordion UI with structured information)
  - Template-based detail sections (e.g., "Details", "Ingredients", "Feeding Instructions")
  - Product-specific overrides and custom sections
- Cross-product variant navigation (switch Flavor/Size instantly)
- Base price display
- Discounted price display (computed server-side)
- Autoship option with visible savings (10% discount)
- "Save X% with Autoship" messaging

Rules:
- Base prices are immutable (never modified by discounts)
- Autoship cheaper pricing clearly labeled
- Variant navigation updates price, images, SKU instantly
- Anonymous browsing allowed (no login required)

---

### 6.2 Orders

Features:
- Order history
- Autoship-generated orders
- Order detail with price breakdown
- Immutable historical pricing

---

### 6.3 Pets (Pet Portal)

Features:
- Create and manage pet profiles
- Link pets to autoships
- Use pet data for recommendations

---

### 6.4 Account

Features:
- Profile management
- Address management
- Autoship management (pause, skip, cancel)
- Logout

---

## 7. Autoship Requirements (Chewy-Style)

### Autoship Behavior

- User subscribes to a product with frequency (every 2/4/8 weeks)
- Autoship generates orders automatically on schedule
- Autoship receives 5-10% discount automatically
- Users can skip next delivery, change frequency, or cancel anytime
- Email reminders before each shipment

### Autoship Features

- One-click enrollment from product page
- **Per-product autoship selection in checkout** (Chewy-style) - Each product in cart can be individually enrolled
- Frequency selection per product (1-24 weeks)
- Quantity adjustment
- Mixed cart support (some items autoship, some one-time)
- Skip next delivery (push back by one cycle)
- Pause autoship (keeps subscription, stops deliveries)
- Cancel autoship (removes subscription)

### Rules

- Autoship pricing implemented via discount rules (not price override)
- Autoship orders lock prices at execution time
- Autoship execution is idempotent and retry-safe
- Inventory checked before autoship order creation

---

## 8. Discounts & Pricing Requirements

### Pricing Principles

- Base price lives on `products.base_price_idr` (immutable)
- Discounts are defined separately in `discounts` table
- Final prices are computed server-side (never on client)
- Orders store locked price snapshot (base, discount, final)
- Price immutability ensures historical accuracy

### Discount Types

- **Promotional Discounts**: Time-limited campaigns, category-wide sales
- **Autoship Discounts**: Permanent 5-10% savings for autoship orders
- **Tiered Pricing**: Buy more, save more (future)
- **First-Time Customer**: Welcome discounts (future)

### Discount Application Rules

- Autoship discount applies only when `order.source = 'autoship'`
- Promo discounts follow stacking policy (`best_only` or `stack`)
- Autoship + Promo can stack (configurable)
- Historical orders never affected by future discount changes
- Discounts never overwrite base prices

---

## 9. Admin Requirements

### Core Capabilities

Admin must be able to:
- Manage product families and variant dimensions
- Set base prices directly on products (`base_price_idr`)
- Create and manage discount rules
- Define autoship cheaper discounts (kind = 'autoship')
- Preview effective prices (one-time vs autoship)
- Manage inventory with audit trail
- Process and monitor orders
- Monitor autoship execution and demand

### Restrictions

- Admin must never manually override final prices
- Base prices can only be changed explicitly (not via discounts)
- Orders are immutable after creation
- Inventory must never go negative

---

## 10. Non-Functional Requirements

### Security

- Row Level Security (RLS) on all tables
- Database-enforced authorization (not client-side)
- No pricing logic in client apps
- No service-role keys in client bundles
- Admin access via `profiles.role = 'admin'`

### Reliability

- Inventory must never go negative (transaction-safe)
- Autoship execution must be idempotent and retry-safe
- Orders must be immutable after creation
- Price snapshots locked at order creation
- All destructive operations logged

### Performance

- Product list load: < 1s
- Product detail load: < 0.5s
- Search response: < 500ms
- Database queries: < 200ms (p95)

---

## 11. MVP Definition of Done

MVP is complete when:
- ✅ Product browsing with family variant navigation works
- ✅ One-time orders can be created
- ✅ Autoship enrollment and management works
- ✅ Autoship execution creates orders automatically
- ✅ Autoship cheaper pricing (5-10%) applies correctly
- ✅ Discounts do not corrupt pricing data
- ✅ Order history shows immutable price snapshots
- ✅ Inventory management prevents overselling
- ✅ Admin can manage all catalog, pricing, and orders
- ✅ RLS enforced and validated
- ✅ App is store-submission ready

---

## Next Document

Doc 02 — Architecture Overview
