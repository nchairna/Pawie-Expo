# Doc 07 — Execution Plan (Overall Plan)

Product: Pawie
Version: v1.0
Last Updated: 2026-01-03
Status: Source of Truth

---

## 1. Goal

Deliver a production-ready Chewy-style MVP for Indonesia with:
- Customer mobile app (Expo)
- Admin web app (Next.js)
- Supabase backend with RLS
- Autoship
- Discounts including autoship cheaper
- Pet portal and rule-based personalization foundation

---

## 2. Guiding Rules

- Build the backend foundation first (schema, RLS, pricing functions)
- Never compute prices only on the client
- Never overwrite base prices for discounts
- Lock price snapshots on orders
- Inventory must never go negative
- Autoship must be idempotent and logged

---

## 3. Delivery Phases (High Level)

Phase 0: Repository + environment baseline  
Phase 1: Database schema + RLS baseline  
Phase 2: Catalog + search (customer read paths)  
Phase 3: Pricing + discounts + checkout order creation  
Phase 4: Inventory + admin operations  
Phase 5: Autoship creation + autoship runner  
Phase 6: Pet portal + rule-based personalization surfaces  
Phase 7: QA, monitoring, staging, production release

---

## 4. Definition of Done (Project Level)

Project MVP is done when:
- User can sign up/login
- User can browse and search published products
- User can place a one-time order
- User can create and manage autoship
- Autoship runner creates orders correctly in staging
- Discounts apply correctly including autoship cheaper
- Order history shows locked price snapshots
- Admin can manage products, variants, inventory, discounts, orders, autoships
- RLS is enforced and validated for all tables
- Staging and production deployments are reproducible

---

## 5. Testing Strategy (Minimal but Real)

- RLS tests (must-have)
- Pricing and discount tests (must-have)
- Autoship idempotency tests (must-have)
- Inventory non-negative tests (must-have)
- Smoke tests for mobile and admin flows

---

## 6. Release Strategy

- Develop locally with Supabase local stack
- Deploy to staging early and often
- Validate end-to-end flows in staging
- Deploy to production only after staging checklist passes

---

## Next Document

Doc 08 — Detailed Execution Phases
