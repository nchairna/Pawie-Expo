# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pawie is a Chewy.com-inspired pet product e-commerce platform with mobile app (Expo/React Native) for customers and web admin dashboard (Next.js) for operations. Built on Supabase backend with Postgres + Row Level Security.

**Core Architecture:**
- Single seller model with admin-managed product catalog
- Product families with variant dimensions (Chewy-style variant selector)
- Base pricing + discount rules (including autoship cheaper)
- Autoship subscription system for recurring orders
- Row Level Security enforces all access control

**Current Phase**: Phase 3 (Pricing Engine & Discounts) - Ready to begin
**Completed Phases**:
- ✅ Phase 0: Foundation & Environment Setup
- ✅ Phase 1: Database Schema & RLS
- ✅ Phase 2: Catalog & Product Browsing (includes authentication, search, filtering)

## Common Commands

### Development

```bash
# Root workspace (uses pnpm)
pnpm install                    # Install all dependencies

# Admin app (Next.js)
pnpm dev:admin                  # Start admin app at localhost:3000
cd apps/admin && pnpm build     # Build admin app
cd apps/admin && pnpm lint      # Lint admin app

# Mobile app (Expo)
pnpm dev:mobile                 # Start Expo dev server
cd apps/mobile && pnpm start    # Alternative way to start
cd apps/mobile && pnpm ios      # Run on iOS simulator
cd apps/mobile && pnpm android  # Run on Android emulator
cd apps/mobile && pnpm lint     # Lint mobile app

# Supabase migrations
npx supabase login              # Login to Supabase CLI
npx supabase link --project-ref <ref>  # Link to remote project
npx supabase db push            # Push migrations to remote
npx supabase db reset           # Reset local DB (if using local)
```

### Type Checking

```bash
pnpm type-check                 # Check types in both apps
```

## High-Level Architecture

### Data Model Design Principles

**Product Hierarchy (CRITICAL - different from typical e-commerce):**

1. **Product Families** → Groups related products sharing variant dimensions
   - Example: "Royal Canin Adult Dog Food" family

2. **Variant Dimensions** → Define types of variation (family-scoped, not global)
   - Example: "Flavor", "Size" dimensions for the family

3. **Variant Values** → Possible values per dimension
   - Example: "Lamb", "Chicken" for Flavor; "2lb", "4lb" for Size

4. **Products** → Individual sellable items (specific variant combinations)
   - Example: "Royal Canin Adult - Lamb - 2lb" is ONE product
   - Each product stores `base_price_idr` and `sku` directly on products table
   - Each product has its own images, inventory, and tags

5. **Product Variant Values** → Links products to their variant values (many-to-many)
   - Defines which combination each product represents

6. **Product Tags** → Multi-category support (global, not family-scoped)
   - Example: ["Dry Food", "Lamb", "Allergen Free"]

**Key Points:**
- Price and SKU are on the products table, NOT in a separate variants table
- Not all variant combinations need to exist
- Products can exist without families (standalone products)
- Variant dimensions are scoped to families, not global
- Tags are global and can be assigned to any product

### Pricing Architecture

**Base Price + Discounts (Never Overwrite Base):**
- `products.base_price_idr` is immutable unless admin explicitly changes it
- Discounts are rules stored in `discounts` + `discount_targets` tables
- Final price is computed at read/checkout time (server-side)
- Orders store price snapshot (base, discount, final) at creation
- Autoship cheaper is a discount with `kind = 'autoship'`

**Order Flow:**
1. Server computes pricing using discount rules + context (is_autoship, user_id, quantity)
2. Order creation locks snapshot into `order_items` (unit_base_price_idr, unit_final_price_idr, discount_breakdown)
3. Historical orders remain accurate even if discount rules change

### Security Model (CRITICAL)

**Row Level Security (RLS) enforces everything:**
- Admin vs user separation via `profiles.role` ('admin' | 'user')
- Helper function `is_admin()` used in RLS policies
- Both admin and mobile apps use anon keys (NEVER service role in client)
- Service role reserved for server-side functions only

**Access Patterns:**
- Anonymous: Read published products only
- Users: CRUD own pets/addresses/autoships, read own orders
- Admin: Full catalog management, inventory, discounts, view all user data

**Golden Rules (from .cursorrules):**
1. NEVER put service_role key in apps/mobile or apps/admin
2. Do not weaken RLS to fix permission issues
3. No secrets in code or committed docs
4. Prefer smallest safe change

### Data Access Patterns

**Admin App (apps/admin/lib/):**
- `supabase.ts` - Client initialization (uses NEXT_PUBLIC_SUPABASE_ANON_KEY)
- `supabase-server.ts` - Server-side client for Server Components
- `supabase-client.ts` - Client-side wrapper
- `auth.ts` - Auth helpers (getCurrentProfile, isAdmin)
- `products.ts` - Product CRUD operations
- `families.ts` - Product family management
- `variant-dimensions.ts` - Variant dimension/value management
- `tags.ts` - Product tag management
- `images.ts` - Image upload/management

**Common Pattern:**
```typescript
// Server Component
import { createClient } from '@/lib/supabase-server';
const supabase = await createClient();

// Client Component
import { supabase } from '@/lib/supabase-client';
```

### File Organization

```
apps/
├── admin/                      # Next.js admin dashboard
│   ├── app/                   # App router pages
│   │   ├── login/            # Auth pages
│   │   ├── products/         # Product catalog management
│   │   ├── families/         # Product family management
│   │   └── tags/             # Tag management
│   ├── components/            # shadcn/ui components
│   ├── lib/                   # Data access + utilities
│   │   ├── supabase*.ts      # Supabase clients
│   │   ├── auth.ts           # Auth helpers
│   │   ├── products.ts       # Product data access
│   │   ├── families.ts       # Family data access
│   │   └── types.ts          # TypeScript types
│   └── package.json
├── mobile/                     # Expo mobile app
│   ├── app/                   # File-based routing
│   ├── lib/                   # Data access
│   │   └── supabase.ts       # Client init
│   └── package.json
supabase/
└── migrations/                 # SQL migrations (numbered)
    ├── 0001_schema.sql        # Core tables
    ├── 0002_rls_policies.sql  # RLS policies
    ├── 0008_product_families_variant_dimensions.sql
    └── 0012_add_price_sku_to_products.sql  # Price/SKU on products
docs/
├── overview/                   # Architecture docs (source of truth)
│   ├── 02_Architecture.md
│   ├── 03_Data_Model.md       # CRITICAL: Data model reference
│   ├── 04_API_Data_Flow.md
│   └── 05_Admin_App_Specs.md
└── implementation/             # Phase execution docs
    ├── Phase_0.md             # Environment setup ✅
    ├── Phase_1.md             # Schema + RLS ✅
    ├── Phase_2.md             # Catalog + Search + Auth ✅
    └── Phase_3.md             # Pricing Engine (next)
```

## Phase 2 Achievements (Completed)

**Authentication**:
- ✅ Admin app login/register with route guards
- ✅ Mobile app auth with session persistence
- ✅ Role-based access control (admin vs user)

**Admin Catalog Management**:
- ✅ Product CRUD with images, tags, and variant assignment
- ✅ Product family and variant dimension management
- ✅ Image upload with reordering and primary image selection
- ✅ Tag management and assignment

**Mobile Catalog**:
- ✅ Product list with 2-column grid and infinite scroll
- ✅ Product detail with image carousel
- ✅ Chewy-style variant selector with instant switching
- ✅ Optimistic UI updates for variant navigation
- ✅ Related products navigation

**Search & Filter**:
- ✅ Postgres full-text search with prefix matching and typo tolerance
- ✅ Tag-based filtering with AND logic
- ✅ Performance-optimized with GIN indexes

**What's Working**:
- All catalog features tested and functional
- RLS policies enforced across all tables
- Variant navigation smooth with 0-1ms selection delay
- Search handles typos and partial queries

### Migration Strategy

**All schema changes via migrations:**
- Numbered files: `0001_schema.sql`, `0002_rls_policies.sql`, etc.
- Never edit tables manually in dashboard without creating migration
- Keep migrations small and clearly named
- RLS policies live in separate migration files from schema

**Migration Workflow:**
```bash
# Create new migration locally
npx supabase migration new <name>

# Apply to remote
npx supabase db push

# Reset local DB (if using local dev)
npx supabase db reset
```

### Environment Configuration

**Admin App (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Mobile App (.env.local):**
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Never commit these files** - they're in .gitignore.

## Important Implementation Notes

### Product Family Variant System

When implementing variant selectors or product navigation:
1. Fetch product family with its dimensions/values
2. Display variant selector showing available combinations
3. Link between products in same family by swapping variant values
4. Each product in family has its own price, SKU, inventory

### Creating/Updating Products

**When creating products in families:**
1. Must assign exactly one variant value per dimension in the family
2. Price and SKU must be set on the product itself
3. Validation ensures all dimensions are covered

**Example flow:**
```typescript
// 1. Create product
await createProduct({
  name: "Product Name",
  family_id: "uuid",
  base_price_idr: 150000,
  sku: "SKU-123",
  variant_value_ids: ["value-id-1", "value-id-2"], // One per dimension
});
```

### Admin UI Conventions

- Uses shadcn/ui components for consistency
- Clean black/white minimal design
- Every screen needs: loading, empty, error states
- Form validation with react-hook-form + Zod
- Toast notifications with sonner

### Mobile UI Conventions

- Bottom tabs: Shop, Orders, Pets, Account
- Shop accessible without login (published products only)
- Orders/Pets require authentication
- Auth screens shown when signed out

## Key Documentation References

**Before making significant changes, consult:**
- `docs/overview/03_Data_Model.md` - Authoritative data model spec
- `docs/overview/04_API_Data_Flow.md` - Pricing and order flows
- `.cursorrules` - Security rules and coding standards

**If code conflicts with docs:**
- Documentation (Doc 03, Doc 04) takes precedence
- Update code to match docs, not vice versa

## Critical Reminders

1. **Price/SKU Location**: On `products` table, not in separate variants table
2. **RLS First**: Never bypass RLS - fix queries or roles instead
3. **Anon Keys Only**: Client apps use anon keys; service role is server-only
4. **Family Scoping**: Variant dimensions belong to families, not global
5. **Standalone Products**: Products can exist without families (family_id nullable)
6. **Migration Discipline**: All schema changes via numbered migration files
