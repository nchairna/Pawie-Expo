# System Overview - Pawie E-Commerce Platform (Chewy.com-Inspired)

**Version**: 2.0
**Last Updated**: 2026-01-07
**Status**: Architecture Definition

---

## Executive Summary

Pawie is a pet product e-commerce platform inspired by Chewy.com's industry-leading features, built for the Indonesian market. This document defines the complete system architecture following e-commerce best practices.

### Core Business Model

- **Single Seller Model**: Pawie operates as the sole merchant (like Chewy.com)
- **Pet-First Experience**: Product recommendations based on pet profiles
- **Autoship Subscription**: Recurring deliveries with automatic discounts (Chewy's killer feature)
- **Family Variant Navigation**: Intelligent product variant selector (Chewy-style UI)
- **Always-On Discounts**: Tiered pricing, autoship savings, promotional campaigns

### Platform Components

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
│                                                              │
└─────────────────────────────────────────────────────────────┘

     External Services:
     - Payment Gateway (Midtrans/Xendit)
     - Shipping API (SiCepat/JNE)
     - Email Service (Resend/SendGrid)
     - SMS Notifications (Twilio)
```

---

## Chewy.com Feature Parity

### Already Implemented ✅

1. **Product Family Variant System**
   - Family-scoped variant dimensions (Size, Flavor, Count)
   - Cross-product variant navigation
   - Not all combinations required (sparse matrix support)

2. **Row Level Security**
   - Database-enforced access control
   - Admin vs User separation
   - Anonymous browsing support

3. **Multi-Image Products**
   - Multiple images per product
   - Primary image optimization
   - Sort order management

4. **Product Tagging**
   - Multi-category support
   - Global tag library
   - Tag-based filtering

5. **Autoship Schema**
   - Subscription frequency
   - Next run tracking
   - Execution history

### To Be Implemented 🔄

1. **Autoship Features** (Phase 5)
   - One-click autoship enrollment
   - Automatic discount application (5-10% savings)
   - Skip/reschedule next delivery
   - Quantity adjustment
   - Cancel anytime
   - Email reminders before shipment
   - Automatic payment processing

2. **Dynamic Pricing Engine** (Phase 3)
   - Real-time discount calculation
   - Stacking rules (autoship + promo)
   - Tiered pricing (buy more, save more)
   - First-time customer discounts
   - Category-wide sales
   - Product-specific promotions

3. **Inventory Management** (Phase 3)
   - Real-time stock tracking
   - Low stock warnings
   - Out-of-stock notifications
   - Restock alerts
   - Backorder support
   - Reserved inventory (pending orders)

4. **Smart Search & Filters** (Phase 3-4)
   - Full-text search
   - Filter by: Brand, Price, Life Stage, Special Diet
   - Sort by: Relevance, Price, Rating, Popularity
   - Pet-specific recommendations

5. **Reviews & Ratings** (Phase 4)
   - Verified purchase reviews
   - Photo uploads
   - Helpful votes
   - Q&A section
   - Average rating display

6. **Pet Profiles** (Phase 4)
   - Pet type, breed, age, weight
   - Dietary restrictions
   - Medication schedules
   - Vet records
   - Recommended products

7. **Order Tracking** (Phase 3-4)
   - Real-time shipment tracking
   - Delivery notifications
   - Signature on delivery
   - Photo proof of delivery
   - Easy returns/exchanges

---

## Chewy.com-Inspired User Flows

### 1. First-Time Purchase Flow

```
User Journey:
1. Browse products (no login required)
2. Add to cart
3. Sign up/login at checkout
4. Enter shipping address
5. Add pet profile (optional but encouraged)
6. See autoship offer: "Save 10% with autoship!"
7. Choose one-time or autoship
8. Payment
9. Order confirmation
10. Autoship enrollment confirmation (if selected)
```

### 2. Autoship Enrollment Flow (Chewy-Style)

```
From Product Detail Page:
┌─────────────────────────────────────────────┐
│ Royal Canin Adult Dry Dog Food - Lamb 4lb  │
│                                             │
│ One-Time Purchase:    Rp 250,000          │
│ Autoship & Save 10%:  Rp 225,000          │
│                                             │
│ ○ One-Time Purchase                        │
│ ● Autoship (Cancel Anytime)                │
│                                             │
│ Deliver every: [2 weeks ▼]                │
│                                             │
│ [Add to Cart]                              │
└─────────────────────────────────────────────┘

Benefits shown:
✓ Save 10% on every order
✓ Free shipping on orders over Rp 300,000
✓ Skip, pause, or cancel anytime
✓ Change frequency or quantity
✓ Get reminders before each shipment
```

### 3. Variant Navigation Flow (Chewy-Style)

```
Product Family: "Royal Canin Adult Dry Dog Food"

Current Product: Lamb - 4lb

Variant Selector:
┌─────────────────────────────────────────────┐
│ Flavor:                                     │
│ [Lamb] [Chicken] [Goat]                    │
│                                             │
│ Size:                                       │
│ [2lb] [4lb] [6lb] [Unavailable]           │
│                                             │
│ Each combination is a different product    │
│ Clicking updates: price, images, SKU,      │
│ availability, reviews                       │
└─────────────────────────────────────────────┘

Implementation:
- Each variant is a separate product
- Instant navigation between variants
- URL updates for SEO (royal-canin-lamb-4lb)
- Share-friendly product links
```

### 4. Autoship Management Flow

```
My Autoship Dashboard:
┌─────────────────────────────────────────────┐
│ Active Autoship Orders (3)                  │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Royal Canin Lamb 4lb                │   │
│ │ Every 2 weeks • Next: Jan 15, 2026  │   │
│ │ Qty: 2 • Rp 450,000 (10% off)       │   │
│ │                                      │   │
│ │ [Skip Next] [Edit] [Cancel]         │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Purina Pro Plan Chicken 8lb         │   │
│ │ Every 4 weeks • Next: Jan 22, 2026  │   │
│ │ Qty: 1 • Rp 380,000 (10% off)       │   │
│ │                                      │   │
│ │ [Skip Next] [Edit] [Cancel]         │   │
│ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘

Actions:
- Skip next delivery (push back by one cycle)
- Change frequency (weekly, bi-weekly, monthly)
- Update quantity
- Pause autoship (keeps subscription but stops deliveries)
- Cancel autoship (removes subscription)
```

---

## Key Architectural Decisions

### 1. Single Seller Model

**Decision**: Pawie is the only seller (not a marketplace)

**Rationale**:
- Simpler inventory management
- Consistent customer experience
- Better quality control
- No complex seller onboarding
- Matches Chewy.com model

**Impact**:
- No multi-vendor features needed
- All products managed by admin
- Centralized fulfillment
- Easier to implement autoship

### 2. Family-Scoped Variants

**Decision**: Variant dimensions belong to product families, not global

**Rationale**:
- Dog food has "Flavor" and "Size"
- Cat toys don't need "Flavor"
- Prevents irrelevant variant options
- Matches Chewy.com UX

**Example**:
```
Family: "Royal Canin Dog Food"
Dimensions: ["Flavor", "Size"]

Family: "Kong Toys"
Dimensions: ["Color", "Durability"]

These are SEPARATE dimension sets
```

### 3. Price Immutability

**Decision**: Base price on products table is immutable, discounts are separate rules

**Rationale**:
- Historical order accuracy (orders store snapshot)
- Easy to audit price changes
- Discount rules can be time-limited
- Clear separation of concerns
- Industry standard pattern

**Implementation**:
```sql
products.base_price_idr  -- Never changes unless admin explicitly updates
discounts table          -- Time-limited rules
order_items              -- Stores snapshot: base, discount, final
```

### 4. Autoship as Discount Context

**Decision**: Autoship cheaper implemented as discount rule, not price override

**Rationale**:
- Discount can be changed globally (e.g., increase from 5% to 10%)
- Orders store discount breakdown
- Clear visibility into savings
- Can stack with other discounts (configurable)

**Implementation**:
```sql
discounts.kind = 'autoship'
discount_targets.applies_to_all_products = true

At checkout:
- Check if order.source = 'autoship'
- Apply autoship discount
- Stack with other eligible discounts per stack_policy
```

### 5. Row Level Security First

**Decision**: All authorization enforced at database level via RLS

**Rationale**:
- Cannot be bypassed by buggy client code
- Supabase best practice
- Admin can use same database with elevated permissions
- Multi-tenant ready
- Security in depth

**Implementation**:
```sql
-- Helper function
is_admin() returns boolean

-- Policies on every table
products: SELECT (published = true OR is_admin())
orders: SELECT (user_id = auth.uid() OR is_admin())
```

### 6. Optimistic UI Updates

**Decision**: Admin UI shows immediate updates, rollback on error

**Rationale**:
- Better UX for admin operations
- Fast perceived performance
- Clear error feedback

**Implementation**:
- Client-side state update immediately
- API call in background
- Rollback on failure with toast notification

---

## Data Flow Architecture

### Read Path (Product Browsing)

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

### Write Path (Order Creation)

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

### Autoship Execution Path

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

---

## Technology Stack Justification

### Backend: Supabase (PostgreSQL)

**Why Supabase**:
- ✅ Built-in auth (email/password, OAuth)
- ✅ Row Level Security (database-enforced authorization)
- ✅ Real-time subscriptions (for live inventory updates)
- ✅ Edge Functions (serverless compute)
- ✅ Storage (images)
- ✅ Generous free tier
- ✅ Scales to millions of rows
- ✅ Excellent TypeScript support

**Why PostgreSQL**:
- ✅ ACID transactions (critical for orders/inventory)
- ✅ JSON support (flexible product attributes)
- ✅ Full-text search (product search)
- ✅ Mature ecosystem
- ✅ Excellent performance for OLTP workloads

### Admin App: Next.js 15

**Why Next.js**:
- ✅ Server components (faster initial load)
- ✅ App router (file-based routing)
- ✅ Image optimization
- ✅ TypeScript first-class support
- ✅ Excellent dev experience
- ✅ SEO friendly (if public pages added later)

**Why shadcn/ui**:
- ✅ Copy-paste components (no dependency bloat)
- ✅ Radix UI primitives (accessibility)
- ✅ Tailwind CSS (utility-first styling)
- ✅ Highly customizable
- ✅ Modern, clean design

### Mobile App: Expo

**Why Expo**:
- ✅ Fast iteration (hot reload)
- ✅ OTA updates (fix bugs without app store approval)
- ✅ Expo Router (file-based navigation)
- ✅ Native modules (camera, notifications)
- ✅ EAS Build (cloud builds)
- ✅ Easier than bare React Native

**Why React Native**:
- ✅ Code sharing with web (hooks, logic)
- ✅ Native performance
- ✅ Large ecosystem
- ✅ Hot reload
- ✅ TypeScript support

---

## Security Architecture

### Authentication

- Supabase Auth (JWT tokens)
- Email/password (initial)
- OAuth (Google, Facebook) - Phase 4
- Magic links - Phase 4

### Authorization

- Role-based access control (admin vs user)
- Row Level Security enforces at database
- Helper function: `is_admin()`
- All queries filtered by RLS policies

### API Keys

- **Anon Key**: Used in mobile + admin apps (public, safe to expose)
- **Service Role Key**: Used only in Edge Functions (server-side)
- Never commit keys to git (use .env.local)

### Data Protection

- HTTPS enforced
- Passwords hashed by Supabase Auth
- Sensitive fields (payment info) never stored
- PCI compliance via payment gateway (Midtrans/Xendit)

---

## Performance Targets

### Mobile App

- **First Contentful Paint**: < 2s
- **Time to Interactive**: < 3s
- **Product List Load**: < 1s
- **Product Detail Load**: < 0.5s
- **Search Response**: < 500ms

### Admin App

- **Dashboard Load**: < 2s
- **Product List (100 items)**: < 1s
- **Product Edit**: < 0.5s
- **Bulk Operations**: < 5s for 100 items

### Database

- **Simple Query**: < 50ms (p95)
- **Complex Query** (joins): < 200ms (p95)
- **Write Operation**: < 100ms (p95)
- **Transaction**: < 300ms (p95)

### Scaling Assumptions

- **Phase 1**: 1,000 orders/month
- **Phase 2**: 10,000 orders/month
- **Phase 3**: 100,000 orders/month
- **PostgreSQL can handle**: 1M+ orders/month with proper indexing

---

## Monitoring & Observability

### Metrics to Track

**Business Metrics**:
- Orders per day
- Autoship enrollment rate
- Autoship churn rate
- Average order value
- Customer lifetime value

**Technical Metrics**:
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Inventory accuracy
- Payment success rate

### Tools

- **Supabase Dashboard**: Query performance, database stats
- **Sentry**: Error tracking (frontend + backend)
- **PostHog**: Product analytics
- **Supabase Logs**: Edge Function logs

---

## Deployment Architecture

### Environments

1. **Local Development**
   - Supabase local (optional)
   - Next.js dev server
   - Expo dev client

2. **Staging**
   - Supabase staging project
   - Vercel staging deployment
   - Expo preview builds

3. **Production**
   - Supabase production project
   - Vercel production deployment
   - Expo production builds (App Store + Play Store)

### CI/CD Pipeline

```
Git Push
    ↓
GitHub Actions
    ↓
1. Lint (ESLint + Prettier)
2. Type check (TypeScript)
3. Unit tests (Vitest)
4. Integration tests (Playwright)
5. Build (Next.js + Expo)
    ↓
Deploy to Vercel (admin)
Deploy to Expo (mobile - preview)
    ↓
Run smoke tests
    ↓
Notify team (Slack/Discord)
```

---

## Development Workflow

### Branching Strategy

- `main` - production
- `staging` - pre-production
- `feature/*` - feature branches
- `fix/*` - bug fixes

### Pull Request Process

1. Create feature branch
2. Implement + test locally
3. Open PR with description
4. Automated checks run
5. Code review (1 approval required)
6. Merge to staging
7. Deploy to staging
8. QA testing
9. Merge to main
10. Deploy to production

### Database Migrations

```bash
# Create migration
npx supabase migration new <name>

# Test locally
npx supabase db reset

# Apply to staging
npx supabase db push --project-ref <staging-ref>

# Apply to production
npx supabase db push --project-ref <prod-ref>
```

---

## Next Steps

1. **Review Critical Fixes**: See `/docs/critical-fixes/README.md`
2. **Implement Autoship**: See `/docs/guides/Autoship_Implementation.md`
3. **Implement Discounts**: See `/docs/guides/Discount_System.md`
4. **Implement Pricing**: See `/docs/guides/Pricing_Engine.md`
5. **Complete Phase 3**: Orders + Checkout + Inventory

---

## References

- Chewy.com: https://www.chewy.com
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Expo Docs: https://docs.expo.dev

---

**Document Status**: ✅ Complete
**Next Review**: After Phase 3 completion
