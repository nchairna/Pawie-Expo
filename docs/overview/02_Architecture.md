# Doc 02 — Architecture Overview

Product: Pawie  
Version: v2.0 (Chewy.com-Inspired)  
Last Updated: 2026-01-07  
Status: Source of Truth

---

## 1. Architecture Goals

The architecture must satisfy the following goals:

- **Production-Ready**: Secure, scalable, maintainable from day one
- **Chewy.com Parity**: Replicate core Chewy features (autoship, variant navigation, discounts)
- **Security First**: Database-enforced authorization via Row Level Security
- **Performance**: Fast product browsing, search, and checkout
- **Extensibility**: Ready for autoship, personalization, and future features
- **Clear Boundaries**: Separation between customer, admin, and backend systems

---

## 2. System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         PAWIE PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Mobile App   │         │  Admin App   │                 │
│  │ (Expo/RN)    │         │  (Next.js)   │                 │
│  │              │         │              │                 │
│  │ - Shop       │         │ - Catalog    │                 │
│  │ - Autoship   │         │ - Orders     │                 │
│  │ - Orders     │         │ - Inventory  │                 │
│  │ - Pets       │         │ - Discounts  │                 │
│  │ - Account    │         │ - Analytics  │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         └────────┬───────────────┘                          │
│                  │                                          │
│         ┌────────▼─────────┐                                │
│         │  Supabase Edge   │                                │
│         │  - Auth          │                                │
│         │  - Row Level     │                                │
│         │    Security      │                                │
│         │  - Edge Funcs    │                                │
│         └────────┬─────────┘                                │
│                  │                                          │
│         ┌────────▼─────────────────────────┐                │
│         │   PostgreSQL Database            │                │
│         │   - Products & Variants          │                │
│         │   - Orders & Autoship            │                │
│         │   - Inventory & Pricing          │                │
│         │   - Users & Pets                 │                │
│         └────────┬─────────────────────────┘                │
│                  │                                          │
│         ┌────────▼─────────┐                                │
│         │  Supabase Storage│                                │
│         │  - Product Images│                                │
│         │  - Pet Photos    │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘

External Services:
- Payment Gateway (Midtrans/Xendit)
- Shipping API (SiCepat/JNE)
- Email Service (Resend/SendGrid)
- SMS Notifications (Twilio)
```

The system consists of:

- **Mobile Application** (Expo/React Native) - Customer-facing
- **Admin Web Application** (Next.js) - Internal operations
- **Supabase Backend** - Database, auth, storage, Edge Functions
- **Server-Side Jobs** - Autoship execution, scheduled tasks

---

## 3. Applications

### 3.1 Mobile Application

**Platform**: Expo (React Native)

**Responsibilities**:
- User authentication (email/password)
- Product browsing with family variant navigation (Chewy-style)
- Fast search (Postgres-based)
- One-time purchases
- Autoship enrollment and management
- Pet profile management
- Order history and tracking
- Anonymous browsing (no login required for shop)

**Key Features**:
- Chewy-style variant selector (switch Flavor/Size instantly)
- Autoship enrollment with visible savings
- Skip/pause/cancel autoship
- Pet-based recommendations

**Restrictions**:
- No access to service-role credentials
- All data access constrained by Row Level Security
- Can only read/write user-owned data
- Pricing computed server-side (never on client)

---

### 3.2 Admin Web Application

**Platform**: Next.js 15 with shadcn/ui

**Responsibilities**:
- Product family and variant dimension management
- Product catalog management (price, SKU, images)
- Inventory management with audit trail
- Discount and pricing rule management
- Order processing and monitoring
- Customer and pet visibility
- Autoship monitoring and controls
- Analytics and reporting

**Security**:
- Authenticated via Supabase Auth
- Admin privileges enforced at database level (RLS)
- Role-based access via `profiles.role = 'admin'`
- Elevated operations use server-side functions

---

## 4. Backend (Supabase)

**Supabase provides**:
- Authentication (email/password, OAuth ready)
- PostgreSQL database (single source of truth)
- Row Level Security (RLS) on all tables
- Storage (product images, pet photos)
- Edge Functions (serverless compute for pricing, autoship)
- Real-time subscriptions (for live inventory updates)

**Key Architectural Decisions**:
- **RLS First**: All authorization enforced at database level
- **Price Immutability**: Base prices never modified, discounts separate
- **Autoship as Discount**: Autoship cheaper implemented as discount rule
- **Family-Scoped Variants**: Variant dimensions belong to product families
- **Transaction Safety**: Inventory and orders use ACID transactions

---

## 5. Source of Truth

**Supabase Postgres** is the single source of truth for:

- Users and profiles (with role-based access)
- Pets and pet attributes
- Product families, variant dimensions, and variant values
- Products (with `base_price_idr` and `sku` directly on products table)
- Product tags and tag assignments (multi-category)
- Product images (paths stored in DB, files in Storage)
- Inventory and inventory movements (audit trail)
- Discounts and discount targets
- Orders and order items (with immutable price snapshots)
- Autoships and autoship execution records
- Addresses

**Key Data Model Principles**:
- Products have `base_price_idr` directly (no separate variants table)
- Each product represents a specific variant combination
- Discounts are separate rules (never modify base prices)
- Orders store price snapshots (base, discount, final)

---

## 6. Security Model

### 6.1 Authentication

- Email and password authentication via Supabase Auth
- Sessions handled by Supabase SDKs (JWT tokens)
- OAuth ready (Google, Facebook) - Phase 4+
- Magic links - Phase 4+

### 6.2 Authorization

- **Row Level Security (RLS)** enabled on all tables
- Database-enforced access control (cannot be bypassed)
- Users can only access their own records
- Admin access gated by `profiles.role = 'admin'`
- Helper function: `is_admin()` for policy checks
- Anonymous browsing allowed (published products only)

### 6.3 Service Role Usage

- Service role key **never exposed** to client applications
- Used only in Edge Functions (server-side)
- Required for autoship execution and privileged operations
- Never stored in client bundles or environment variables

### 6.4 Storage Security

- Product images stored in Supabase Storage (`product-images` bucket)
- Public read for published products (or signed URLs)
- Write access restricted to admin users (RLS-enforced)
- Pet photos stored with user-scoped access

---

## 7. Core Data Flows

### 7.1 Product Browsing and Search (Read Path)

```
Mobile App (Anonymous or User)
    ↓
Supabase Client (anon key)
    ↓
RLS Policy: products.published = true
    ↓
PostgreSQL Query:
    SELECT * FROM products
    WHERE published = true
    AND family_id = ?
    ↓
Return: Products with variant navigation data
```

- Anonymous browsing allowed (no login required)
- Only published products visible
- Family-based variant navigation
- Server-side pricing computation

### 7.2 Order Creation (Write Path)

```
Mobile App (Authenticated User)
    ↓
Supabase Edge Function: create_order
    ↓
1. Validate cart items (products exist, published)
2. Compute pricing (call pricing engine)
3. Validate inventory (reserve stock)
4. Create order record (with price snapshot)
5. Create order_items (with discount breakdown)
6. Decrement inventory
7. If autoship: create autoship record
8. Return order confirmation
    ↓
Commit transaction (all-or-nothing)
```

**Rules**:
- Inventory must never go negative (transaction-safe)
- Orders are immutable after creation
- Price snapshots locked at creation time

### 7.3 Autoship Management

- Customers create autoships linked to products
- Autoship schedule stored in database
- Customers can pause, skip next delivery, or cancel
- Frequency adjustable (weekly, bi-weekly, monthly)

### 7.4 Autoship Execution (Scheduled)

```
Scheduled Job (runs every hour)
    ↓
Find autoships where next_run_at <= NOW()
    ↓
For each autoship:
    1. Check inventory availability
    2. Compute current pricing (may have changed)
    3. Attempt payment
    4. If success: create order + update next_run_at
    5. If fail: retry logic + notify user
    6. Log autoship_run record
    ↓
Send email confirmations
```

**Requirements**:
- Idempotent and retry-safe
- Inventory checked before order creation
- Price computed at execution time (may differ from enrollment)

### 7.5 Admin Operations

- Admin updates product catalog (families, variants, prices)
- Admin manages discounts and pricing rules
- Admin adjusts inventory (with audit trail)
- Admin updates order status
- Changes immediately reflected in customer apps

---

## 8. Search Architecture

### 8.1 MVP Search

- Postgres-based full-text search
- Indexed product name and description fields
- Tag-based filtering
- Server-side filtering and sorting

### 8.2 Future Search (Phase 4+)

- External search engine integration (Algolia/Meilisearch)
- Event-driven indexing
- Personalization-aware ranking
- Pet-specific recommendations

---

## 9. Personalization Architecture

### 9.1 MVP Personalization (Phase 6)

**Inputs**:
- Pet species, breed, age, weight
- Activity level, dietary restrictions
- Order history
- Autoship patterns

**Logic**:
- Rule-based logic executed server-side
- Transparent and explainable outputs
- Pet profile matching

**Outputs**:
- Recommended products
- Reorder suggestions
- "Customers also bought" suggestions

### 9.2 Future Personalization

- ML-based recommendations (Phase 7+)
- Behavioral tracking
- A/B testing framework

---

## 10. Environment Strategy

Environments:
- Local development
- Staging
- Production

Rules:
- Schema changes via migrations only
- No manual database edits in production
- Environment-specific secrets

---

## 11. Observability and Reliability

Production requirements:
- Inventory movement logs
- Autoship execution logs
- Order status history
- Error tracking for all applications

---

## 12. Deployment Overview

- Mobile app built and submitted via Expo EAS
- Admin web deployed via Vercel
- Supabase used as managed backend

---

## 13. Architecture Principles

### Core Principles

1. **Single Seller Model**: Pawie is the only merchant (not a marketplace)
2. **RLS First**: All authorization enforced at database level
3. **Price Immutability**: Base prices never modified, discounts separate
4. **Autoship as Discount**: Autoship cheaper implemented as discount rule
5. **Family-Scoped Variants**: Variant dimensions belong to product families
6. **Transaction Safety**: Inventory and orders use ACID transactions
7. **Server-Side Pricing**: Pricing computed server-side, never on client
8. **No Shortcuts**: Never weaken RLS for convenience

---

## Next Document

Doc 03 — Data Model and Row Level Security Plan
