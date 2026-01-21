# Doc 05 - Admin App Specification

Product: Pawie Admin Dashboard
Version: v3.0 (Consolidated)
Last Updated: 2026-01-21
Status: Source of Truth

---

## 1. Overview

The Pawie Admin Dashboard is a Next.js 16 application for managing the pet product e-commerce platform. It provides operational management for products, orders, inventory, autoships, and discounts.

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI Components**: shadcn/ui
- **Database**: Supabase (Postgres + RLS)
- **Auth**: Supabase Auth with role-based access
- **Styling**: Tailwind CSS

---

## 2. Architecture

### 2.1 Route Structure

```
app/
├── (auth)/                    # Auth layout (no sidebar)
│   ├── login/
│   └── register/
├── (dashboard)/               # Main app layout (with sidebar)
│   ├── layout.tsx            # Sidebar + header + breadcrumbs
│   ├── page.tsx              # Dashboard home
│   ├── products/             # Product management
│   │   ├── page.tsx          # Server Component with pagination
│   │   ├── new/
│   │   ├── [id]/             # Split into tabs (routes)
│   │   │   ├── page.tsx      # Info tab
│   │   │   ├── images/       # Images tab
│   │   │   └── details/      # Details tab
│   │   └── actions.ts        # Server Actions
│   ├── families/             # Product families
│   ├── tags/                 # Product tags
│   ├── orders/               # Order management
│   ├── autoships/            # Subscription management
│   ├── discounts/            # Discount rules
│   └── inventory/            # Stock management
└── layout.tsx                # Root layout
```

### 2.2 Data Fetching Patterns

**Server Components (Default)**
- All list pages are Server Components with server-side data fetching
- Uses `searchParams` for pagination and filtering
- Streaming with Suspense for better UX

**Server Actions (Mutations)**
- All mutations use Server Actions (`'use server'`)
- Zod validation for all inputs
- `revalidatePath()` for cache invalidation
- Returns `{ success: true }` or `{ error: string }`

**Client Components (Interactive)**
- Forms with react-hook-form
- Dialogs and modals
- Real-time filters

### 2.3 Authentication

```typescript
// lib/auth-server.ts
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/forbidden');
  return { user, profile };
}
```

---

## 3. Completed Features

### 3.1 Dashboard
- Real-time stats (orders, revenue, inventory, autoships)
- Quick action buttons
- Recent orders widget
- Low stock alerts widget
- Suspense streaming for progressive loading

### 3.2 Product Management
- Server-side paginated list (50 per page)
- Search by name/SKU (server-side)
- Filter by family, published status, tags
- Bulk actions (publish, unpublish, delete, assign tags)
- Split edit page into tab routes (Info, Images, Details)
- Image management with drag-drop upload and reordering

### 3.3 Order Management
- Server-side paginated list (20 per page)
- Filter by status, source, date range
- Order detail with items, customer, address
- Status update workflow

### 3.4 Inventory Management
- Server-side paginated list using RPC function
- Filter by low stock, out of stock
- Quick add stock buttons
- Adjust inventory dialog with preview
- Movement history per product

### 3.5 Autoship Management
- Active/Paused/Cancelled tabs
- Pause, resume, cancel actions
- View associated orders

### 3.6 Discounts
- Create/edit discount rules
- Promo and autoship discount types
- Target specific products or all products
- Active/inactive toggle

### 3.7 Navigation & UX
- Sectioned sidebar (Dashboard, Catalog, Sales, Operations)
- Breadcrumb navigation (auto-generated from URL)
- Keyboard shortcuts (g+h, g+p, g+o, g+i, /, ?)
- Top loading bar (nextjs-toploader)
- Optimistic navigation with useTransition
- Loading skeletons for all data-heavy pages

---

## 4. Performance Optimizations

### 4.1 Caching Strategy

| Data Type | Revalidate | Pages |
|-----------|------------|-------|
| Real-time | 0 (no cache) | Dashboard, Inventory |
| Dynamic | 60 seconds | Products, Orders, Autoships |
| Static | 3600 seconds | Families, Tags (when converted to Server Components) |

### 4.2 Database Optimizations

**Indexes Applied:**
```sql
-- Products
idx_products_published, idx_products_family_id,
idx_products_updated_at, idx_products_base_price

-- Orders
idx_orders_status, idx_orders_source,
idx_orders_created_at, idx_orders_user_id

-- Inventory
idx_inventory_stock, idx_inventory_updated,
idx_inventory_movements_product
```

**RPC Functions:**
- `get_dashboard_stats()` - All dashboard metrics in one query
- `get_order_stats()` - Order statistics (replaces 6 queries with 1)
- `get_all_products_with_inventory()` - Paginated inventory with product data
- `get_products_inventory_count()` - Fast count for pagination

### 4.3 Query Optimizations
- Select specific columns instead of `*`
- Use `.single()` for single-row queries
- No N+1 queries (verified)
- All queries use indexes

### 4.4 Image Optimization
- Next.js Image component with automatic WebP/AVIF conversion
- Supabase Storage CDN integration
- Lazy loading for below-fold images
- Proper `sizes` attributes for responsive images

---

## 5. Key Files Reference

### Data Access Layer
```
lib/
├── supabase-server.ts       # Server-side Supabase client
├── auth-server.ts           # requireAdmin(), getCurrentProfile()
├── products-server.ts       # getProducts(), getProduct()
├── orders-server.ts         # getOrders(), getOrderById(), getOrderStats()
├── inventory-server.ts      # getInventory(), getLowStockProducts()
├── dashboard-server.ts      # getDashboardStats()
└── types.ts                 # TypeScript interfaces
```

### Reusable Components
```
components/
├── ui/                      # shadcn components
│   ├── table-skeleton.tsx
│   ├── stats-skeleton.tsx
│   ├── empty-state.tsx
│   ├── pagination.tsx
│   ├── breadcrumb-nav.tsx
│   └── keyboard-shortcuts.tsx
├── data-table/              # Generic data table
│   ├── data-table.tsx
│   ├── selectable-data-table.tsx
│   └── bulk-actions-toolbar.tsx
└── forms/                   # Form components
    ├── image-upload.tsx
    ├── tag-multi-select.tsx
    └── product-selector.tsx
```

---

## 6. Future Optimizations

### 6.1 Performance
- [ ] Convert Families, Tags, Discounts to Server Components
- [ ] Add cache tags for granular revalidation (`revalidateTag()`)
- [ ] Implement SWR for client-side caching where appropriate
- [ ] Consider materialized views for complex analytics

### 6.2 Features
- [ ] Audit logging system (create, update, delete tracking)
- [ ] Customer management module (view-only customer data)
- [ ] System settings page
- [ ] Real-time subscriptions for inventory changes
- [ ] Export functionality (CSV/Excel)

### 6.3 UX Improvements
- [ ] Rich text editor for product descriptions
- [ ] Advanced product search (full-text search)
- [ ] Drag-drop for product ordering
- [ ] Batch product creation from CSV

### 6.4 Infrastructure
- [ ] Error tracking integration (Sentry)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Automated testing (Playwright)
- [ ] CI/CD pipeline improvements

---

## 7. Commands Reference

```bash
# Development
pnpm dev:admin              # Start dev server

# Build & Deploy
cd apps/admin && pnpm build # Production build
cd apps/admin && pnpm lint  # Run linting

# Database
npx supabase db push        # Push migrations
npx supabase migration new <name>  # Create migration
```

---

## 8. Security

- **RLS Enforced**: All database operations go through Row Level Security
- **Admin Role Check**: `requireAdmin()` in all Server Components and Actions
- **Anon Key Only**: Client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never service role)
- **Input Validation**: Zod schemas for all Server Action inputs
- **No Secrets in Code**: Environment variables for all configuration

---

## Appendix: Migration History

| Migration | Purpose |
|-----------|---------|
| 0029 | Performance indexes for products, orders, inventory |
| 0030 | Dashboard stats RPC function |
| 0031 | Paginated inventory RPC function |
| 0032 | Low stock threshold column |
| 0033 | Dashboard stats RPC fix |
| 0034 | Order stats RPC function |
| 0035 | Fix inventory RPC add product_id |

---

**Document Status:** Current
**Last Review:** 2026-01-21
