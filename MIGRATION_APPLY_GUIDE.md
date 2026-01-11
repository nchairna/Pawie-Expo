# Migration Application Guide

## Your Current Migrations

1. **0001_schema.sql** - Core tables (profiles, products, pets, orders, autoships, etc.)
2. **0002_rls_policies.sql** - Row Level Security policies
3. **0003_seed.sql** - Seed data
4. **0004_storage_policies.sql** - Storage bucket policies
5. **0005_product_images_schema.sql** - Product images table
6. **0006_product_images_rls.sql** - Product images RLS
7. **0007_product_images_verification.sql** - Verification queries
8. **0008_product_families_variant_dimensions.sql** - ⚠️ CRITICAL - Adds families, dimensions, tags
9. **0009_product_families_variant_dimensions_rls.sql** - RLS for families/dimensions
10. **0010_product_families_verification.sql** - Verification
11. **0011_fix_is_admin_recursion.sql** - Fixes admin function
12. **0012_add_price_sku_to_products.sql** - ⚠️ CRITICAL - Adds base_price_idr and sku to products

## What Your Code Expects

Your admin app code expects:

### Products Table Structure
```sql
products (
  id uuid
  name text
  description text
  category text
  published boolean
  autoship_eligible boolean
  family_id uuid -- FROM MIGRATION 0008
  base_price_idr integer -- FROM MIGRATION 0012
  sku text -- FROM MIGRATION 0012
  created_at timestamptz
  updated_at timestamptz
)
```

### Related Tables
- `product_families` - Groups products (FROM MIGRATION 0008)
- `variant_dimensions` - Dimension definitions (FROM MIGRATION 0008)
- `variant_values` - Possible values per dimension (FROM MIGRATION 0008)
- `product_variant_values` - Links products to values (FROM MIGRATION 0008)
- `product_tags` - Tags for products (FROM MIGRATION 0008)
- `product_tag_assignments` - Product-tag relationships (FROM MIGRATION 0008)

## Migration Strategy

### Strategy 1: Clean Slate (Recommended for Development)

If you're okay resetting your database:

```bash
# WARNING: This will delete ALL data!
npx supabase db reset

# Then link and push
npx supabase link --project-ref ccvxxtkwfdxtoigkumfx
npx supabase db push
```

### Strategy 2: Selective Apply (If you have existing data)

If migrations 0001-0007 are already applied but 0008-0012 are missing:

**Option A: Manual Apply in Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/migrations/0008_product_families_variant_dimensions.sql`
3. Run it
4. Repeat for 0009, 0011, 0012 (skip 0010 - it's just verification)

**Option B: Use Supabase CLI**
```bash
# Apply remaining migrations
npx supabase db push
```

### Strategy 3: Check and Sync

Run the diagnostic first:

```bash
# 1. Check what's in your database
# Run check-schema.sql in Supabase Dashboard

# 2. Compare with migrations
# Review supabase/migrations/ folder

# 3. Apply missing migrations
# Either use db push or manual SQL Editor
```

## Common Issues

### Issue 1: "products.base_price_idr does not exist"

**Cause**: Migration 0012 not applied
**Fix**: Run migration 0012 manually or use `npx supabase db push`

### Issue 2: "product_families table does not exist"

**Cause**: Migration 0008 not applied
**Fix**: Run migration 0008 manually or use `npx supabase db push`

### Issue 3: "relation product_variants already exists"

**Cause**: You have old schema that conflicts with new schema
**Fix**: Need to reconcile. Either:
- Drop conflicting tables and reapply migrations
- Modify migrations to handle existing schema

## After Applying Migrations

1. **Verify Schema**: Run `check-schema.sql`
2. **Test Admin App**:
   - Start admin app: `cd apps/admin && pnpm dev`
   - Try creating a product family
   - Try creating a product with family assignment
3. **Check RLS**: Verify policies are working (see Phase_1.md)

## Need Help?

If you're stuck:
1. Run `check-schema.sql` and share results
2. Run `npx supabase db pull` to see current schema
3. Share any error messages from admin app or migrations