/**
 * Product detail sections data access functions
 * Admin-only operations for managing product detail sections
 */

import { supabase } from './supabase';
import type { ProductDetailTemplate, TemplateSection } from './product-detail-templates';

// Re-export types for convenience
export type { ProductDetailTemplate, TemplateSection } from './product-detail-templates';

export interface ProductDetailSection {
  id: string;
  product_id: string;
  template_section_id: string | null;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductDetailSectionInput {
  template_section_id?: string | null;
  title: string;
  content: string;
  sort_order?: number;
}

/**
 * Get all templates (for dropdowns)
 */
export async function getTemplates(): Promise<ProductDetailTemplate[]> {
  const { data, error } = await supabase
    .from('product_detail_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Get template sections for a template
 */
export async function getTemplateSections(
  templateId: string
): Promise<TemplateSection[]> {
  const { data, error } = await supabase
    .from('product_detail_template_sections')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch template sections: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all detail sections for a product (merged view)
 * Returns both template sections and product-specific overrides/custom sections
 */
export async function getProductDetailSections(
  productId: string
): Promise<ProductDetailSection[]> {
  const { data, error } = await supabase
    .from('product_detail_sections')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch product detail sections: ${error.message}`);
  }

  return data || [];
}

/**
 * Set product's template assignment
 */
export async function setProductTemplate(
  productId: string,
  templateId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ detail_template_id: templateId })
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to set product template: ${error.message}`);
  }
}

/**
 * Upsert product detail section (create or update)
 */
export async function upsertProductSection(
  productId: string,
  sectionId: string | null,
  input: ProductDetailSectionInput
): Promise<ProductDetailSection> {
  if (sectionId) {
    // Update existing section
    const { data, error } = await supabase
      .from('product_detail_sections')
      .update({
        title: input.title,
        content: input.content,
        ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
        ...(input.template_section_id !== undefined && {
          template_section_id: input.template_section_id,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sectionId)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product section: ${error.message}`);
    }

    return data;
  } else {
    // Create new section
    const { data, error } = await supabase
      .from('product_detail_sections')
      .insert({
        product_id: productId,
        title: input.title,
        content: input.content,
        template_section_id: input.template_section_id || null,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product section: ${error.message}`);
    }

    return data;
  }
}

/**
 * Delete product detail section
 */
export async function deleteProductSection(sectionId: string): Promise<void> {
  const { error } = await supabase
    .from('product_detail_sections')
    .delete()
    .eq('id', sectionId);

  if (error) {
    throw new Error(`Failed to delete product section: ${error.message}`);
  }
}

/**
 * Reorder product detail sections
 */
export async function reorderProductSections(
  productId: string,
  sectionIds: string[]
): Promise<void> {
  // Update sort_order for each section based on its position in the array
  const updates = sectionIds.map((sectionId, index) =>
    supabase
      .from('product_detail_sections')
      .update({ sort_order: index })
      .eq('id', sectionId)
      .eq('product_id', productId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(
      `Failed to reorder product sections: ${errors[0].error?.message}`
    );
  }
}
