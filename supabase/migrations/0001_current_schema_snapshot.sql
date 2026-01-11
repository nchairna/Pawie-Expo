-- Migration: Current Database Schema Snapshot
-- Generated from live Supabase database
-- Project: Pawie-Expo (ccvxxtkwfdxtoigkumfx)
-- Date: 2026-01-03

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: is_admin()
-- Returns true if the current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Function: handle_new_user()
-- Creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    email text,
    full_name text,
    phone text,
    phone_verified boolean NOT NULL DEFAULT false,
    role text NOT NULL DEFAULT 'user'::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: product_families
CREATE TABLE IF NOT EXISTS public.product_families (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_families IS 'Groups related products with shared variant dimensions';
COMMENT ON COLUMN public.product_families.name IS 'Family name, e.g., "Royal Canin Adult Dog Food"';

-- Table: variant_dimensions
CREATE TABLE IF NOT EXISTS public.variant_dimensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.product_families(id),
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variant_dimensions IS 'Defines variant types for a product family (e.g., "Flavor", "Size")';
COMMENT ON COLUMN public.variant_dimensions.family_id IS 'Dimensions are scoped to a product family';
COMMENT ON COLUMN public.variant_dimensions.name IS 'Dimension name, e.g., "Flavor", "Size"';
COMMENT ON COLUMN public.variant_dimensions.sort_order IS 'Display order in UI';

-- Table: variant_values
CREATE TABLE IF NOT EXISTS public.variant_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_id uuid NOT NULL REFERENCES public.variant_dimensions(id),
    value text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variant_values IS 'Possible values for each variant dimension';
COMMENT ON COLUMN public.variant_values.dimension_id IS 'Value belongs to a dimension';
COMMENT ON COLUMN public.variant_values.value IS 'Value text, e.g., "Lamb", "2lb bag"';
COMMENT ON COLUMN public.variant_values.sort_order IS 'Display order in UI';

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    category text,
    published boolean NOT NULL DEFAULT false,
    autoship_eligible boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    primary_image_path text,
    family_id uuid REFERENCES public.product_families(id),
    base_price_idr integer,
    sku text
);

COMMENT ON COLUMN public.products.family_id IS 'Links product to a family for variant dimension navigation';
COMMENT ON COLUMN public.products.base_price_idr IS 'Base price in Indonesian Rupiah. For family-based products, this is the single price. For products with multiple variants, this can be the default/primary price.';
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit. For family-based products, this is the single SKU. For products with multiple variants, this can be the default/primary SKU.';

-- Table: product_variant_values
CREATE TABLE IF NOT EXISTS public.product_variant_values (
    product_id uuid NOT NULL REFERENCES public.products(id),
    variant_value_id uuid NOT NULL REFERENCES public.variant_values(id),
    PRIMARY KEY (product_id, variant_value_id)
);

COMMENT ON TABLE public.product_variant_values IS 'Links products to variant values (many-to-many)';
COMMENT ON COLUMN public.product_variant_values.product_id IS 'Product that has this variant value';
COMMENT ON COLUMN public.product_variant_values.variant_value_id IS 'Variant value assigned to product';

-- Table: product_images
CREATE TABLE IF NOT EXISTS public.product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id),
    path text NOT NULL,
    alt_text text,
    sort_order integer NOT NULL DEFAULT 0,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: product_tags
CREATE TABLE IF NOT EXISTS public.product_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_tags IS 'Tags for multi-category support';
COMMENT ON COLUMN public.product_tags.name IS 'Tag display name, e.g., "Dry Food"';
COMMENT ON COLUMN public.product_tags.slug IS 'URL-friendly slug, e.g., "dry-food"';

-- Table: product_tag_assignments
CREATE TABLE IF NOT EXISTS public.product_tag_assignments (
    product_id uuid NOT NULL REFERENCES public.products(id),
    tag_id uuid NOT NULL REFERENCES public.product_tags(id),
    PRIMARY KEY (product_id, tag_id)
);

COMMENT ON TABLE public.product_tag_assignments IS 'Many-to-many relationship between products and tags';

-- Table: inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id),
    stock_quantity integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id)
);

-- Table: inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id),
    change_quantity integer NOT NULL,
    reason text,
    reference_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: discounts
CREATE TABLE IF NOT EXISTS public.discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    kind text NOT NULL,
    discount_type text NOT NULL,
    value integer NOT NULL,
    active boolean NOT NULL DEFAULT false,
    starts_at timestamptz,
    ends_at timestamptz,
    min_order_subtotal_idr integer,
    stack_policy text NOT NULL DEFAULT 'best_only'::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: discount_targets
CREATE TABLE IF NOT EXISTS public.discount_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_id uuid NOT NULL REFERENCES public.discounts(id),
    product_id uuid REFERENCES public.products(id),
    category text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: pets
CREATE TABLE IF NOT EXISTS public.pets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    name text,
    species text,
    breed text,
    age integer,
    weight numeric,
    activity_level text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: addresses
CREATE TABLE IF NOT EXISTS public.addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    label text,
    address_line text,
    city text,
    province text,
    postal_code text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: orders
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    status text NOT NULL DEFAULT 'pending'::text,
    source text NOT NULL DEFAULT 'one_time'::text,
    subtotal_idr integer NOT NULL DEFAULT 0,
    discount_total_idr integer NOT NULL DEFAULT 0,
    total_idr integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    quantity integer NOT NULL,
    unit_base_price_idr integer NOT NULL,
    unit_final_price_idr integer NOT NULL,
    discount_total_idr integer NOT NULL DEFAULT 0,
    discount_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: autoships
CREATE TABLE IF NOT EXISTS public.autoships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    pet_id uuid REFERENCES public.pets(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    quantity integer NOT NULL,
    frequency_weeks integer NOT NULL,
    next_run_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'active'::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: autoship_runs
CREATE TABLE IF NOT EXISTS public.autoship_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    autoship_id uuid NOT NULL REFERENCES public.autoships(id),
    scheduled_at timestamptz NOT NULL,
    executed_at timestamptz,
    status text NOT NULL,
    order_id uuid REFERENCES public.orders(id),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Product families indexes
CREATE INDEX IF NOT EXISTS product_families_name_idx ON public.product_families(name);

-- Variant dimensions indexes
CREATE INDEX IF NOT EXISTS variant_dimensions_family_id_idx ON public.variant_dimensions(family_id);
CREATE INDEX IF NOT EXISTS variant_dimensions_family_sort_idx ON public.variant_dimensions(family_id, sort_order);

-- Variant values indexes
CREATE INDEX IF NOT EXISTS variant_values_dimension_id_idx ON public.variant_values(dimension_id);
CREATE INDEX IF NOT EXISTS variant_values_dimension_sort_idx ON public.variant_values(dimension_id, sort_order);

-- Products indexes
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category);
CREATE INDEX IF NOT EXISTS products_family_id_idx ON public.products(family_id);
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products(name);
CREATE INDEX IF NOT EXISTS products_published_idx ON public.products(published);
CREATE INDEX IF NOT EXISTS products_primary_image_path_idx ON public.products(primary_image_path);
CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products(sku) WHERE sku IS NOT NULL;

-- Product variant values indexes
CREATE INDEX IF NOT EXISTS product_variant_values_product_id_idx ON public.product_variant_values(product_id);
CREATE INDEX IF NOT EXISTS product_variant_values_value_id_idx ON public.product_variant_values(variant_value_id);

-- Product images indexes
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS product_images_product_id_sort_order_idx ON public.product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS product_images_primary_idx ON public.product_images(product_id) WHERE is_primary = true;

-- Product tags indexes
CREATE INDEX IF NOT EXISTS product_tags_name_idx ON public.product_tags(name);
CREATE INDEX IF NOT EXISTS product_tags_slug_idx ON public.product_tags(slug);

-- Product tag assignments indexes
CREATE INDEX IF NOT EXISTS product_tag_assignments_product_id_idx ON public.product_tag_assignments(product_id);
CREATE INDEX IF NOT EXISTS product_tag_assignments_tag_id_idx ON public.product_tag_assignments(tag_id);

-- Inventory indexes
-- (unique constraint on product_id already creates an index)

-- Inventory movements indexes
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS inventory_movements_created_at_idx ON public.inventory_movements(created_at);

-- Discounts indexes
CREATE INDEX IF NOT EXISTS discounts_active_idx ON public.discounts(active);
CREATE INDEX IF NOT EXISTS discounts_kind_idx ON public.discounts(kind);
CREATE INDEX IF NOT EXISTS discounts_starts_at_idx ON public.discounts(starts_at);
CREATE INDEX IF NOT EXISTS discounts_ends_at_idx ON public.discounts(ends_at);

-- Discount targets indexes
CREATE INDEX IF NOT EXISTS discount_targets_discount_id_idx ON public.discount_targets(discount_id);
CREATE INDEX IF NOT EXISTS discount_targets_product_id_idx ON public.discount_targets(product_id);
CREATE INDEX IF NOT EXISTS discount_targets_category_idx ON public.discount_targets(category);

-- Pets indexes
CREATE INDEX IF NOT EXISTS pets_user_id_idx ON public.pets(user_id);

-- Addresses indexes
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON public.addresses(user_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_source_idx ON public.orders(source);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at);

-- Order items indexes
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items(product_id);

-- Autoships indexes
CREATE INDEX IF NOT EXISTS autoships_user_id_idx ON public.autoships(user_id);
CREATE INDEX IF NOT EXISTS autoships_status_idx ON public.autoships(status);
CREATE INDEX IF NOT EXISTS autoships_next_run_at_idx ON public.autoships(next_run_at);

-- Autoship runs indexes
CREATE INDEX IF NOT EXISTS autoship_runs_autoship_id_idx ON public.autoship_runs(autoship_id);
CREATE INDEX IF NOT EXISTS autoship_runs_scheduled_at_idx ON public.autoship_runs(scheduled_at);
CREATE INDEX IF NOT EXISTS autoship_runs_status_idx ON public.autoship_runs(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autoships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autoship_runs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT
    USING ((auth.uid() = id) OR is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Product families policies
CREATE POLICY "product_families_public_read" ON public.product_families
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "product_families_admin_all" ON public.product_families
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Variant dimensions policies
CREATE POLICY "variant_dimensions_public_read" ON public.variant_dimensions
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "variant_dimensions_admin_all" ON public.variant_dimensions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Variant values policies
CREATE POLICY "variant_values_public_read" ON public.variant_values
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "variant_values_admin_all" ON public.variant_values
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Products policies
CREATE POLICY "products_public_select_published_or_admin" ON public.products
    FOR SELECT
    TO public
    USING ((published = true) OR is_admin());

CREATE POLICY "products_admin_insert" ON public.products
    FOR INSERT
    TO public
    WITH CHECK (is_admin());

CREATE POLICY "products_admin_update" ON public.products
    FOR UPDATE
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "products_admin_delete" ON public.products
    FOR DELETE
    TO public
    USING (is_admin());

-- Product variant values policies
CREATE POLICY "product_variant_values_public_read" ON public.product_variant_values
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM products
            WHERE products.id = product_variant_values.product_id
                AND products.published = true
        )
    );

CREATE POLICY "product_variant_values_admin_all" ON public.product_variant_values
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Product images policies
CREATE POLICY "product_images_public_select_published_or_admin" ON public.product_images
    FOR SELECT
    TO public
    USING (
        is_admin() OR (
            EXISTS (
                SELECT 1
                FROM products p
                WHERE p.id = product_images.product_id
                    AND p.published = true
            )
        )
    );

CREATE POLICY "product_images_admin_insert" ON public.product_images
    FOR INSERT
    TO public
    WITH CHECK (is_admin());

CREATE POLICY "product_images_admin_update" ON public.product_images
    FOR UPDATE
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "product_images_admin_delete" ON public.product_images
    FOR DELETE
    TO public
    USING (is_admin());

-- Product tags policies
CREATE POLICY "product_tags_public_read" ON public.product_tags
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "product_tags_admin_all" ON public.product_tags
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Product tag assignments policies
CREATE POLICY "product_tag_assignments_public_read" ON public.product_tag_assignments
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM products
            WHERE products.id = product_tag_assignments.product_id
                AND products.published = true
        )
    );

CREATE POLICY "product_tag_assignments_admin_all" ON public.product_tag_assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'::text
        )
    );

-- Inventory policies
CREATE POLICY "inventory_admin_all" ON public.inventory
    FOR ALL
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

-- Inventory movements policies
CREATE POLICY "inventory_movements_admin_all" ON public.inventory_movements
    FOR ALL
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

-- Discounts policies
CREATE POLICY "discounts_admin_all" ON public.discounts
    FOR ALL
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

-- Discount targets policies
CREATE POLICY "discount_targets_admin_all" ON public.discount_targets
    FOR ALL
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

-- Pets policies
CREATE POLICY "pets_crud_own_or_admin" ON public.pets
    FOR ALL
    TO public
    USING ((auth.uid() = user_id) OR is_admin())
    WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- Addresses policies
CREATE POLICY "addresses_crud_own_or_admin" ON public.addresses
    FOR ALL
    TO public
    USING ((auth.uid() = user_id) OR is_admin())
    WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- Orders policies
CREATE POLICY "orders_select_own_or_admin" ON public.orders
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id) OR is_admin());

-- Order items policies
CREATE POLICY "order_items_select_own_orders_or_admin" ON public.order_items
    FOR SELECT
    TO public
    USING (
        is_admin() OR (
            EXISTS (
                SELECT 1
                FROM orders o
                WHERE o.id = order_items.order_id
                    AND o.user_id = auth.uid()
            )
        )
    );

-- Autoships policies
CREATE POLICY "autoships_crud_own_or_admin" ON public.autoships
    FOR ALL
    TO public
    USING ((auth.uid() = user_id) OR is_admin())
    WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- Autoship runs policies
CREATE POLICY "autoship_runs_select_own_or_admin" ON public.autoship_runs
    FOR SELECT
    TO public
    USING (
        is_admin() OR (
            EXISTS (
                SELECT 1
                FROM autoships a
                WHERE a.id = autoship_runs.autoship_id
                    AND a.user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: on_auth_user_created
-- Creates a profile when a new user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


