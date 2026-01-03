# Doc 01 — Product Requirements Document (PRD)

Product: Pawie
Version: v1.2 (Pricing, Discounts, Autoship Cheaper)
Last Updated: 2026-01-03
Status: Source of Truth

---

## 1. Product Overview

Pawie is a mobile-first pet commerce platform inspired by Chewy and built for the Indonesian market.

Core value propositions:
- Convenience via Autoship (recurring orders)
- Trust via accurate pricing, inventory, and order history
- Long-term value via pet-based personalization

Pricing, discounts, and autoship are first-class features and must be implemented safely and transparently.

---

## 2. Product Goals

Primary goals:
- Support one-time purchases and autoship
- Offer autoship cheaper pricing as a permanent incentive
- Support promotional discounts without corrupting price data
- Lock prices at order creation for legal and accounting safety
- Be production-ready from day one

Non-goals (MVP):
- No ML-based pricing
- No loyalty points or cashback
- No COD
- No multi-vendor marketplace

---

## 3. Target Users

Customer:
- Indonesian pet owners
- Repeat buyers of consumables
- Want automation and predictable pricing

Admin:
- Manages products, pricing rules, inventory, and orders
- Controls autoship eligibility and discount rules

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

### 6.1 Shop

Features:
- Product browsing
- Fast search
- Product detail pages
- Variant selection
- Base price display
- Discounted price display (computed)
- Autoship option with visible savings

Rules:
- Base prices are never modified by discounts
- Autoship cheaper pricing must be clearly labeled

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

## 7. Autoship Requirements

Autoship behavior:
- User subscribes to a variant
- Autoship generates orders on schedule
- Autoship receives cheaper pricing automatically
- Users can cancel anytime

Rules:
- Autoship pricing is implemented via discount rules
- Autoship orders lock prices at execution time

---

## 8. Discounts & Pricing Requirements

Pricing principles:
- Base price lives on product variants
- Discounts are defined separately
- Final prices are computed server-side
- Orders store a locked price snapshot

Discount types:
- Promotional discounts
- Autoship cheaper discounts

Discount application rules:
- Autoship discount applies only to autoship orders
- Promo discounts follow defined stacking rules
- Historical orders are never affected by future changes

---

## 9. Admin Requirements

Admin must be able to:
- Set base prices per variant
- Create and manage discount rules
- Define autoship cheaper discounts
- Preview effective prices
- Manage inventory and orders

Admin must never manually override final prices.

---

## 10. Non-Functional Requirements

Security:
- RLS on all tables
- No pricing logic in client apps
- No service-role keys on clients

Reliability:
- Inventory must never go negative
- Autoship execution must be idempotent
- Orders must be immutable after creation

---

## 11. MVP Definition of Done

MVP is complete when:
- One-time and autoship orders work
- Autoship cheaper pricing is applied correctly
- Discounts do not corrupt pricing data
- Order history remains accurate
- App is store-submission ready

---

## Next Document

Doc 02 — Architecture Overview
