-- ============================================================================
-- Migration: 0028_product_detail_accordion
-- Purpose: Create product detail accordion system with templates and sections
--          Supports template-based sections with per-product overrides
-- ============================================================================

-- Table: product_detail_templates
CREATE TABLE IF NOT EXISTS public.product_detail_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_detail_templates IS 'Reusable templates for product detail sections (e.g., Food Template, Bed Template)';
COMMENT ON COLUMN public.product_detail_templates.name IS 'Template name (e.g., "Food Template", "Bed Template")';
COMMENT ON COLUMN public.product_detail_templates.description IS 'Optional description of what this template is used for';

-- Table: product_detail_template_sections
CREATE TABLE IF NOT EXISTS public.product_detail_template_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.product_detail_templates(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL DEFAULT '',
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_detail_template_sections IS 'Sections within a template (e.g., "Details", "Ingredients", "Feeding Instructions")';
COMMENT ON COLUMN public.product_detail_template_sections.title IS 'Section title (e.g., "Details", "Ingredients")';
COMMENT ON COLUMN public.product_detail_template_sections.content IS 'HTML content for the section (can be empty for template structure)';
COMMENT ON COLUMN public.product_detail_template_sections.sort_order IS 'Display order within the template';

-- Table: product_detail_sections
CREATE TABLE IF NOT EXISTS public.product_detail_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    template_section_id uuid REFERENCES public.product_detail_template_sections(id) ON DELETE SET NULL,
    title text NOT NULL,
    content text NOT NULL DEFAULT '',
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_detail_sections IS 'Product-specific detail sections (can override template sections or be custom)';
COMMENT ON COLUMN public.product_detail_sections.template_section_id IS 'If set, this section overrides the corresponding template section';
COMMENT ON COLUMN public.product_detail_sections.title IS 'Section title';
COMMENT ON COLUMN public.product_detail_sections.content IS 'HTML content for the section';
COMMENT ON COLUMN public.product_detail_sections.sort_order IS 'Display order (merged with template sections)';

-- Add detail_template_id to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS detail_template_id uuid REFERENCES public.product_detail_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.products.detail_template_id IS 'Optional template assignment for product detail sections';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Template indexes
CREATE INDEX IF NOT EXISTS product_detail_templates_name_idx ON public.product_detail_templates(name);

-- Template section indexes
CREATE INDEX IF NOT EXISTS product_detail_template_sections_template_id_idx ON public.product_detail_template_sections(template_id);
CREATE INDEX IF NOT EXISTS product_detail_template_sections_template_sort_idx ON public.product_detail_template_sections(template_id, sort_order);

-- Product section indexes
CREATE INDEX IF NOT EXISTS product_detail_sections_product_id_idx ON public.product_detail_sections(product_id);
CREATE INDEX IF NOT EXISTS product_detail_sections_template_section_id_idx ON public.product_detail_sections(template_section_id);
CREATE INDEX IF NOT EXISTS product_detail_sections_product_sort_idx ON public.product_detail_sections(product_id, sort_order);

-- Products template reference index
CREATE INDEX IF NOT EXISTS products_detail_template_id_idx ON public.products(detail_template_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.product_detail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_detail_template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_detail_sections ENABLE ROW LEVEL SECURITY;

-- Product Detail Templates: Public read, Admin CRUD
CREATE POLICY "product_detail_templates_select" ON public.product_detail_templates
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "product_detail_templates_admin_modify" ON public.product_detail_templates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Product Detail Template Sections: Public read, Admin CRUD
CREATE POLICY "product_detail_template_sections_select" ON public.product_detail_template_sections
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "product_detail_template_sections_admin_modify" ON public.product_detail_template_sections
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- Product Detail Sections: Public read if product is published, Admin CRUD
CREATE POLICY "product_detail_sections_select" ON public.product_detail_sections
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM products
            WHERE products.id = product_detail_sections.product_id
                AND products.published = true
        )
    );

CREATE POLICY "product_detail_sections_admin_modify" ON public.product_detail_sections
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'admin'::text
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp for templates
CREATE OR REPLACE FUNCTION update_product_detail_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_detail_templates_updated_at
    BEFORE UPDATE ON public.product_detail_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_product_detail_templates_updated_at();

-- Update updated_at timestamp for template sections
CREATE OR REPLACE FUNCTION update_product_detail_template_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_detail_template_sections_updated_at
    BEFORE UPDATE ON public.product_detail_template_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_product_detail_template_sections_updated_at();

-- Update updated_at timestamp for product sections
CREATE OR REPLACE FUNCTION update_product_detail_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_detail_sections_updated_at
    BEFORE UPDATE ON public.product_detail_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_product_detail_sections_updated_at();
