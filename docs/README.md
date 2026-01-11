# Pawie Documentation Index

**Last Updated**: 2026-01-07
**Version**: 2.0

---

## Welcome

This documentation suite provides comprehensive guidance for building Pawie, a Chewy.com-inspired pet e-commerce platform. The documentation is organized to support both AI-assisted development and human developers.

---

## Quick Start

**New to the project?** Start here:

1. Read [System Overview](./architecture-v2/01_System_Overview.md) - Understand the complete architecture
2. Review [Critical Fixes](./critical-fixes/README.md) - Address these issues first
3. Follow implementation guides in [Guides](./guides/) folder
4. Apply [Best Practices](./best-practices/) for AI development

---

## Documentation Structure

### 📐 Architecture v2 (Improved)

**Purpose**: Comprehensive system architecture following Chewy.com best practices

| Document | Description | Status |
|----------|-------------|--------|
| [01_System_Overview.md](./architecture-v2/01_System_Overview.md) | Complete system architecture, tech stack, Chewy.com feature parity | ✅ Complete |

**Key Features Documented**:
- Single seller model (Pawie as sole merchant)
- Family-scoped variant system (Chewy-style)
- Autoship subscription architecture
- Dynamic pricing with discount rules
- Row Level Security (RLS) design
- Performance targets and scaling assumptions

---

### 🔧 Critical Fixes

**Purpose**: Address critical issues found during audit before Phase 3

| Document | Description | Priority | Status |
|----------|-------------|----------|--------|
| [README.md](./critical-fixes/README.md) | Complete resolution guide for 8 critical issues | 🔴 HIGH | ✅ Complete |

**Issues Covered**:
1. Product Variants Table Orphaning (HIGH)
2. Order Items Schema Inconsistency (HIGH)
3. Discount Application Logic Missing (HIGH)
4. Inventory Validation Missing (HIGH)
5. Debug Logging in Production Code (MEDIUM)
6. Product Variant Values Assignment Overhead (MEDIUM)
7. Missing Validation Constraints (MEDIUM)
8. Category Field Ambiguity (LOW)

**Estimated Effort**: 5.5 days (Phase 2C) + 18 days (Phase 3)

---

### 📚 Implementation Guides

**Purpose**: Step-by-step implementation instructions for major features

| Guide | Description | Phase | Status |
|-------|-------------|-------|--------|
| [Autoship_Implementation.md](./guides/Autoship_Implementation.md) | Complete autoship system (Chewy-style) with scheduler, emails, UI | 5 | ✅ Complete |
| [Discount_System.md](./guides/Discount_System.md) | Industry-standard discount engine with stacking, BOGO, tiered pricing | 3 | ✅ Complete |
| [RLS_Performance_Fixes.md](./guides/RLS_Performance_Fixes.md) | Fix 34 warnings: 22 RLS performance + 7 security (function search_path, extensions) | 2-3 | ✅ Complete |

#### Autoship Guide Highlights

**Covers**:
- Enrollment flows (product page, checkout)
- Management dashboard (skip, pause, cancel, edit)
- Scheduler (cron job, hourly execution)
- Email reminders (3 days before delivery)
- Failure handling (payment retries, out of stock logic)
- Price locking with 10% cap
- Success metrics (enrollment rate, retention, revenue %)

**Code Included**:
- 10+ SQL functions
- Edge Functions (enrollment, scheduler, reminders)
- Mobile UI screens
- Admin dashboard
- Email templates

#### Discount System Guide Highlights

**Discount Types Supported**:
1. Percentage (10% off)
2. Fixed Amount (Rp 50,000 off)
3. BOGO (Buy 2 Get 1 Free)
4. Tiered Pricing (Buy 3-5, save 10%)
5. Cart-Level (Minimum purchase)
6. Autoship (Always 5-10% off)
7. First-Time Customer (30% off first order)
8. Coupon Codes (WELCOME20)

**Stacking Policies**:
- Best Only (single best discount)
- Stack with Autoship (autoship + promo)
- Stack All (combine all discounts)
- Exclusive (only this discount)

**Code Included**:
- Complete pricing engine (15+ SQL functions)
- Discount discovery query
- Stacking logic implementation
- Admin UI for discount management
- Cart pricing Edge Function
- Unit & integration tests

#### RLS Performance & Security Fixes Guide Highlights

**Status**: ✅ **COMPLETED** (2026-01-09)

**Performance Warnings Fixed (28)**:
- 16 `auth_rls_initplan` warnings (auth function re-evaluation) - ✅ Fixed
- 12 `multiple_permissive_policies` warnings (policy consolidation) - ✅ Fixed
- Step-by-step fixes for all 13 affected tables
- **Result**: 10-100x faster queries on large tables

**Security Warnings Fixed (6)**:
- 5 `function_search_path_mutable` warnings (SQL injection risk) 🔴 HIGH - ✅ Fixed
- 1 `extension_in_public` warning (pg_trgm in public schema) - ✅ Fixed
- 1 `auth_leaked_password_protection` (skipped - auth setup incomplete)

**Migrations Applied**:
1. `20260109040911_fix_rls_performance_and_security_warnings.sql` - Main fixes
2. `20260109042552_move_pg_trgm_to_extensions_schema.sql` - Extension move
3. `20260109042932_fix_remaining_multiple_policies_warnings.sql` - Policy separation

**Improvements**:
- All functions secured with fixed search_path
- All RLS policies optimized for performance
- Extension organized in dedicated schema
- Production-ready security posture

---

### 📖 Original Documentation

**Purpose**: Initial architecture docs (Phase 0-2)

| Document | Description | Status |
|----------|-------------|--------|
| [02_Architecture.md](./overview/02_Architecture.md) | Original architecture overview | 📝 Reference |
| [03_Data_Model.md](./overview/03_Data_Model.md) | Database schema (source of truth) | 📝 Reference |
| [04_API_Data_Flow.md](./overview/04_API_Data_Flow.md) | API patterns and data flows | 📝 Reference |
| [05_Admin_App_Specs.md](./overview/05_Admin_App_Specs.md) | Admin app specifications | 📝 Reference |

**Note**: These docs remain as reference. Architecture v2 supersedes where conflicts exist.

---

### 💡 Best Practices (Coming Soon)

**Purpose**: Guidelines for AI-assisted development

| Guide | Description | Status |
|-------|-------------|--------|
| AI_Development_Guide.md | Best practices for Claude Code & Cursor | ⏳ Planned |
| Code_Quality_Standards.md | TypeScript, linting, testing standards | ⏳ Planned |
| Git_Workflow.md | Branching, commits, PRs | ⏳ Planned |

---

## Implementation Phases

### Phase 0: Environment Setup ✅

- Supabase project created
- Next.js admin app scaffolded
- Expo mobile app scaffolded
- pnpm workspace configured

### Phase 1: Database Schema ✅

- 12 core tables created
- RLS policies implemented
- Indexes added
- Sample data seeded

### Phase 2: Product Catalog ✅

**2A**: Product images, storage
**2B**: Product families, variant dimensions, tags, admin UI (90% complete)
**2C**: Mobile catalog UI (⏳ not started)
**2E**: Auth pages (✅ complete)

### Phase 3: Orders & Checkout ⏳

**Prerequisites**: Complete Critical Fixes first!

- Pricing engine implementation
- Inventory management
- Cart functionality
- Order creation
- Payment integration (Midtrans/Xendit)
- Order tracking

### Phase 4: Search & Personalization ⏳

- Full-text search
- Filters (brand, price, life stage)
- Pet profiles
- Recommendations
- Reviews & ratings

### Phase 5: Autoship ⏳

**See**: [Autoship Implementation Guide](./guides/Autoship_Implementation.md)

- Enrollment flows
- Management dashboard
- Scheduler (cron job)
- Email notifications
- Failure handling

### Phase 6: Advanced Features ⏳

- Analytics dashboard
- Mobile push notifications
- Loyalty program
- Referral system
- Customer support chat

---

## Key Architectural Decisions

### 1. Single Seller Model

**Decision**: Pawie is the only merchant (not a marketplace)

**Rationale**:
- Simpler inventory management
- Consistent UX
- Better quality control
- Matches Chewy.com model

### 2. Family-Scoped Variants

**Decision**: Variant dimensions belong to product families, not global

**Example**:
- Dog food family has "Flavor" and "Size"
- Cat toys family has "Color" and "Durability"
- These are separate dimension sets

**Benefits**:
- No irrelevant variant options
- Clean variant selector UI
- Matches Chewy.com UX

### 3. Price Immutability

**Decision**: Base price is immutable, discounts are separate rules

**Implementation**:
```sql
products.base_price_idr  -- Never changes unless admin updates
discounts table          -- Time-limited rules
order_items              -- Stores snapshot: base, discount, final
```

**Benefits**:
- Historical order accuracy
- Easy audit trail
- Discount rules can change without affecting orders

### 4. Row Level Security First

**Decision**: All authorization enforced at database level via RLS

**Benefits**:
- Cannot be bypassed by buggy client code
- Admin uses same database with elevated permissions
- Multi-tenant ready
- Security in depth

### 5. Autoship as Discount Context

**Decision**: Autoship cheaper implemented as discount rule, not price override

**Benefits**:
- Discount can be changed globally (e.g., 5% → 10%)
- Orders store discount breakdown
- Clear visibility into savings
- Can stack with other discounts

---

## Technology Stack

### Backend

- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth (email/password, OAuth planned)
- **Storage**: Supabase Storage (product images)
- **Edge Functions**: Deno (pricing, orders, autoship)

### Frontend

- **Admin**: Next.js 15 + shadcn/ui + Tailwind
- **Mobile**: Expo (React Native) + Expo Router
- **Language**: TypeScript
- **State**: React hooks + Supabase realtime

### Infrastructure

- **Hosting**: Vercel (admin), Expo (mobile)
- **Database**: Supabase (managed Postgres)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + Supabase Dashboard

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI
- Git

### Installation

```bash
# Clone repository
git clone <repo-url>
cd Pawie-Expo

# Install dependencies
pnpm install

# Set up environment variables
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# Run admin app
pnpm dev:admin

# Run mobile app (separate terminal)
pnpm dev:mobile
```

### Database Setup

```bash
# Login to Supabase
npx supabase login

# Link to project
npx supabase link --project-ref <your-ref>

# Apply migrations
npx supabase db push
```

---

## Development Workflow

### Daily Development

1. **Start**: Pull latest from `main`
2. **Feature Branch**: `git checkout -b feature/your-feature`
3. **Develop**: Make changes, test locally
4. **Commit**: `git commit -m "feat: your feature"`
5. **Push**: `git push origin feature/your-feature`
6. **PR**: Open pull request
7. **Review**: Address feedback
8. **Merge**: Squash and merge to `main`

### Database Changes

1. **Create Migration**: `npx supabase migration new <name>`
2. **Edit SQL**: Add schema changes
3. **Test Locally**: `npx supabase db reset`
4. **Deploy Staging**: `npx supabase db push --project-ref <staging>`
5. **Test Staging**: Verify changes
6. **Deploy Production**: `npx supabase db push --project-ref <prod>`

---

## Testing Strategy

### Unit Tests

- **Tools**: Vitest
- **Coverage**: Utilities, helpers, data layer functions
- **Location**: `*.test.ts` files alongside source

### Integration Tests

- **Tools**: Vitest + Supabase test client
- **Coverage**: API endpoints, RLS policies, database functions
- **Location**: `__tests__/integration/`

### E2E Tests

- **Tools**: Playwright (admin), Detox (mobile)
- **Coverage**: Critical user flows
- **Location**: `tests/e2e/`

### Manual Testing

- **Checklist**: See [Testing Strategy Guide](./guides/Testing_Strategy.md) (planned)
- **Environments**: Local, Staging, Production
- **Frequency**: Before each deployment

---

## Deployment

### Staging

- **Admin**: Auto-deploy from `staging` branch (Vercel)
- **Mobile**: EAS preview builds on PR
- **Database**: Separate staging Supabase project

### Production

- **Admin**: Auto-deploy from `main` branch (Vercel)
- **Mobile**: Manual EAS production builds
- **Database**: Production Supabase project
- **Schedule**: Deploy Fridays 2pm Jakarta time

---

## Monitoring

### Metrics Tracked

**Business Metrics**:
- Orders per day
- Autoship enrollment rate
- Average order value
- Customer lifetime value

**Technical Metrics**:
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Inventory accuracy

### Tools

- **Errors**: Sentry
- **Analytics**: PostHog
- **Database**: Supabase Dashboard
- **Uptime**: Better Uptime

---

## Support

### Documentation Issues

- **GitHub**: Open issue with `docs` label
- **Slack**: #pawie-docs channel

### Technical Questions

- **GitHub**: Open discussion
- **Slack**: #pawie-dev channel

### Architecture Decisions

- **Process**: Write ADR (Architecture Decision Record)
- **Review**: Team review required
- **Location**: `docs/adr/`

---

## Contributing

### Code Style

- **TypeScript**: Strict mode
- **Linting**: ESLint + Prettier
- **Naming**: camelCase (variables), PascalCase (components)
- **Files**: kebab-case.ts

### Git Commits

**Format**: `<type>: <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructure
- `test`: Testing
- `chore`: Maintenance

**Example**: `feat: add autoship enrollment flow`

### Pull Requests

**Template**:
```markdown
## Description
[What does this PR do?]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[How was this tested?]

## Checklist
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] TypeScript passes
```

---

## Glossary

**Autoship**: Recurring subscription for regular product deliveries

**Family**: Group of related products sharing variant dimensions (e.g., "Royal Canin Dog Food")

**Variant Dimension**: Type of variation within a family (e.g., "Flavor", "Size")

**Variant Value**: Specific option for a dimension (e.g., "Lamb", "4lb")

**Product**: Individual sellable item (e.g., "Royal Canin Lamb 4lb")

**RLS**: Row Level Security - database-enforced access control

**Discount Stacking**: Combining multiple discounts (e.g., autoship + promo)

**Price Locking**: Freezing price at autoship enrollment (with cap on increases)

**SKU**: Stock Keeping Unit - unique product identifier

**BOGO**: Buy One Get One (promotional discount type)

---

## Appendix

### Useful Links

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Expo Docs**: https://docs.expo.dev
- **shadcn/ui**: https://ui.shadcn.com
- **Chewy.com** (inspiration): https://www.chewy.com

### Migration Files Reference

| File | Description | Phase |
|------|-------------|-------|
| 0001_schema.sql | Core tables | 1 |
| 0002_rls_policies.sql | RLS policies | 1 |
| 0008_product_families_variant_dimensions.sql | Families & variants | 2B |
| 0012_add_price_sku_to_products.sql | Price/SKU on products | 2B |
| 0013_remove_product_variants.sql | Remove deprecated table | 2C (planned) |
| 0014_enhance_discounts.sql | Discount enhancements | 3 (planned) |
| 0015_pricing_engine.sql | Pricing functions | 3 (planned) |
| 0016_inventory_management.sql | Inventory functions | 3 (planned) |

### Project Stats

- **Database Tables**: 12 core + 4 junction
- **Admin UI Pages**: 8 (products, families, tags, auth, etc.)
- **Mobile Screens**: 6 planned (shop, orders, autoship, pets, account)
- **Migrations**: 12 applied, 4 planned
- **Documentation Pages**: 8 comprehensive guides
- **Estimated Phase 3 Effort**: 3.5 weeks
- **Target Launch**: Q2 2026

---

**Document Status**: ✅ Complete
**Maintained By**: Pawie Development Team
**Next Review**: After Phase 3 completion
