# Doc 07 — Execution Plan (Overall Plan)

Product: Pawie
Version: v2.0 (Chewy.com-Inspired Architecture)
Last Updated: 2026-01-07
Status: Source of Truth

---

## 1. Goal

Deliver a production-ready Chewy.com-inspired MVP for Indonesia with:
- Customer mobile app (Expo/React Native)
- Admin web app (Next.js)
- Supabase backend with RLS
- Autoship subscriptions with automatic discounts
- Chewy-style variant navigation
- Discount system with price immutability
- Pet portal and rule-based personalization foundation

---

## 2. Guiding Rules

- **Backend First**: Build schema, RLS, and pricing functions before UI
- **Server-Side Pricing**: Never compute prices on client
- **Price Immutability**: Never overwrite base prices for discounts
- **Order Snapshots**: Lock price snapshots at order creation
- **Inventory Safety**: Inventory must never go negative (transaction-safe)
- **Autoship Idempotency**: Autoship execution must be idempotent and logged
- **RLS Everywhere**: All tables use Row Level Security
- **No Shortcuts**: Never weaken RLS for convenience

---

## 3. Delivery Phases (Detailed Breakdown)

### Phase 0: Foundation & Setup ✅ (Complete)

**Goal**: Repository structure and development environment

**Tasks**:
- [x] Monorepo setup (apps/mobile, apps/admin, supabase)
- [x] Environment configuration (local, staging, production)
- [x] Supabase projects created
- [x] Development tooling (pnpm, Supabase CLI, Expo CLI)

**Duration**: 1 week

---

### Phase 1: Database Schema & RLS ✅ (Complete)

**Goal**: Complete database schema with Row Level Security

**Tasks**:
- [x] Core tables (profiles, pets, products, families, variants)
- [x] Product family variant system
- [x] Inventory tables
- [x] Orders and order_items (with price snapshots)
- [x] Autoship tables
- [x] Discount tables
- [x] RLS policies on all tables
- [x] Helper functions (is_admin, etc.)
- [x] Validation constraints

**Duration**: 2 weeks

**Status**: ✅ Complete (all critical fixes applied)

---

### Phase 2: Catalog & Product Browsing ✅ (Complete)

**Goal**: Customer can browse products with Chewy-style variant navigation

**Mobile App Tasks**:
- [x] Product list screen (published products only)
- [x] Product detail screen
- [x] Chewy-style variant selector (switch Flavor/Size instantly)
- [x] Family-based variant navigation
- [x] Product images display
- [x] Basic search (Postgres-based)
- [x] Tag-based filtering

**Admin App Tasks**:
- [x] Product family management (create, edit, delete)
- [x] Variant dimension management
- [x] Variant value management
- [x] Product CRUD (create, edit, publish)
- [x] Variant value assignment
- [x] Product tag management
- [x] Product image upload
- [x] Base price and SKU management

**Backend Tasks**:
- [x] RLS policies verified
- [x] Product family variant functions
- [x] Product search function
- [x] Storage bucket setup (product-images)

**Duration**: 3 weeks

**Status**: ✅ Complete

---

### Phase 3: Pricing Engine & Discounts ✅ (Complete)

**Goal**: Server-side pricing computation with discount system

**Backend Tasks**:
- [x] `compute_product_price()` function
- [x] Discount finding logic
- [x] Stacking policy implementation
- [x] Autoship discount application
- [x] Price quote Edge Function
- [x] Cart pricing computation

**Admin App Tasks**:
- [x] Discount management UI
- [x] Create/edit discounts
- [x] Discount targets (products, all products)
- [x] Autoship discount setup
- [x] Pricing preview (one-time vs autoship)

**Mobile App Tasks**:
- [x] Display base price
- [x] Display discounted price (computed)
- [x] Show autoship savings
- [x] Price breakdown on product detail

**Duration**: 2 weeks

**Status**: ✅ Complete

---

### Phase 4: Orders & Checkout ✅ (Complete)

**Goal**: Customer can place one-time orders with inventory validation

**Backend Tasks**:
- [x] `create_order_with_inventory()` function ✅
- [x] Inventory validation functions ✅
- [x] `check_product_availability()` function ✅
- [x] `decrement_inventory()` function (transaction-safe) ✅
- [x] Order creation Edge Function ✅
- [x] Inventory movement audit logging ✅

**Mobile App Tasks**:
- [x] Cart management ✅
- [x] Checkout flow ✅
- [x] Address selection/creation ✅
- [x] Order confirmation screen ✅
- [x] Order history screen ✅
- [x] Order detail screen (with price breakdown) ✅

**Admin App Tasks**:
- [x] Order list and filtering ✅
- [x] Order detail view ✅
- [x] Order status updates ✅
- [x] Inventory management UI ✅
- [x] Inventory adjustment (with reason) ✅
- [x] Inventory movement history ✅

**Duration**: 3 weeks

**Status**: ✅ Complete

**Definition of Done**:
- [x] User can place one-time orders ✅
- [x] Inventory validated and decremented ✅
- [x] Orders store immutable price snapshots ✅
- [x] Admin can process orders ✅
- [x] Inventory never goes negative ✅

---

### Phase 5: Autoship System ✅ (Complete)

**Goal**: Autoship enrollment and automatic order creation

**Backend Tasks**:
- [x] `create_autoship()` function ✅
- [x] `create_autoship_with_order()` function (Chewy-style checkout) ✅
- [x] Autoship execution functions (`execute_autoship`, `run_due_autoships`) ✅
- [x] Idempotency checks (autoship_runs) ✅
- [x] Next run date calculation ✅
- [ ] Autoship execution scheduler setup (pending deployment)
- [ ] Email notifications (order confirmations) - Phase 6+

**Mobile App Tasks**:
- [x] Autoship enrollment (from product page) ✅
- [x] Chewy-style autoship enrollment during checkout ✅
- [x] Autoship management screen ✅
- [x] Skip next delivery ✅
- [x] Change frequency ✅
- [x] Pause/cancel autoship ✅
- [x] Autoship order history ✅

**Admin App Tasks**:
- [x] Autoship list and monitoring ✅
- [x] Autoship execution history ✅
- [ ] Autoship demand forecasting (optional)
- [x] Manual autoship controls (pause/cancel) ✅

**Duration**: 3 weeks

**Status**: ✅ Complete

**Definition of Done**:
- [x] User can enroll in autoship (product page + checkout) ✅
- [x] Autoship creates orders automatically ✅
- [x] Autoship execution is idempotent ✅
- [x] User can manage autoship (skip, pause, cancel) ✅
- [x] Admin can monitor autoship execution ✅

---

### Phase 6: Pet Portal & Personalization

**Goal**: Pet profiles and rule-based recommendations

**Backend Tasks**:
- [ ] Pet profile CRUD
- [ ] Rule-based recommendation function
- [ ] Pet-product matching logic
- [ ] Reorder suggestions

**Mobile App Tasks**:
- [ ] Pet profile creation/editing
- [ ] Pet list screen
- [ ] Link pets to autoships
- [ ] Recommended products (pet-based)
- [ ] Reorder suggestions

**Admin App Tasks**:
- [ ] Customer pet visibility
- [ ] Pet-based analytics

**Duration**: 2 weeks

**Definition of Done**:
- User can create and manage pet profiles
- Pet-based recommendations work
- Reorder suggestions appear

---

### Phase 7: QA, Polish & Production Release

**Goal**: Production-ready release

**Tasks**:
- [ ] End-to-end testing
- [ ] RLS security audit
- [ ] Performance testing
- [ ] Error handling and logging
- [ ] Monitoring setup (Sentry, PostHog)
- [ ] Staging deployment
- [ ] Production deployment
- [ ] App store submission (iOS/Android)
- [ ] Documentation

**Duration**: 2 weeks

**Definition of Done**:
- All features tested end-to-end
- Security validated
- Performance targets met
- Staging validated
- Production deployed
- App stores submitted

---

## 4. Definition of Done (Project Level)

Project MVP is complete when:
- ✅ User can sign up/login
- ✅ User can browse and search published products
- ✅ User can navigate variants (Chewy-style)
- ✅ User can place a one-time order
- ✅ User can create and manage autoship
- ✅ Autoship runner creates orders correctly
- ✅ Discounts apply correctly (including autoship cheaper)
- ✅ Order history shows locked price snapshots
- ✅ Admin can manage products, variants, inventory, discounts, orders, autoships
- ✅ RLS is enforced and validated for all tables
- ✅ Inventory never goes negative
- ✅ Staging and production deployments are reproducible
- ✅ App is store-submission ready

---

## 5. Testing Strategy

**Must-Have Tests**:
- RLS policy tests (all tables)
- Pricing and discount tests (all discount types)
- Autoship idempotency tests
- Inventory non-negative tests
- Order creation transaction tests

**Nice-to-Have Tests**:
- End-to-end flow tests (Playwright)
- Performance tests
- Load tests

---

## 6. Release Strategy

**Development**:
- Local development with Supabase local stack
- Feature branches with PR reviews

**Staging**:
- Deploy to staging early and often
- Validate end-to-end flows
- Security and performance testing

**Production**:
- Deploy only after staging checklist passes
- Gradual rollout (if applicable)
- Monitor closely for first 48 hours

---

## 7. Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 0: Foundation | 1 week | ✅ Complete |
| Phase 1: Database & RLS | 2 weeks | ✅ Complete |
| Phase 2: Catalog & Browsing | 3 weeks | ✅ Complete |
| Phase 3: Pricing & Discounts | 2 weeks | ✅ Complete |
| Phase 4: Orders & Checkout | 3 weeks | ✅ Complete |
| Phase 5: Autoship System | 3 weeks | ✅ Complete |
| Phase 6: Pet Portal | 2 weeks | ⏳ Pending |
| Phase 7: QA & Release | 2 weeks | ⏳ Pending |

**Total Estimated Duration**: 18 weeks (~4.5 months)

---

## Next Steps

1. ✅ Phase 4 Complete (Orders & Checkout with Simulated Payment)
2. ✅ Phase 5 Complete (Autoship System)
3. Begin Phase 6 (Pet Portal & Personalization)
4. Continue with remaining phases sequentially
