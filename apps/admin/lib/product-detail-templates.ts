/**
 * Product detail template data access functions
 * Admin-only operations for managing templates and template sections
 */

import { supabase } from './supabase';

export interface ProductDetailTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateInput {
  name: string;
  description?: string | null;
}

export interface TemplateSectionInput {
  title: string;
  content: string;
  sort_order?: number;
}

/**
 * Get all templates
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
 * Get single template by ID
 */
export async function getTemplate(
  id: string
): Promise<ProductDetailTemplate | null> {
  const { data, error } = await supabase
    .from('product_detail_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch template: ${error.message}`);
  }

  return data;
}

/**
 * Create new template
 */
export async function createTemplate(
  input: TemplateInput
): Promise<ProductDetailTemplate> {
  const { data, error } = await supabase
    .from('product_detail_templates')
    .insert({
      name: input.name,
      description: input.description || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return data;
}

/**
 * Update template
 */
export async function updateTemplate(
  id: string,
  input: Partial<TemplateInput>
): Promise<ProductDetailTemplate> {
  const { data, error } = await supabase
    .from('product_detail_templates')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`);
  }

  return data;
}

/**
 * Delete template (cascades to template sections)
 */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_detail_templates')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`);
  }
}

/**
 * Get all sections for a template
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
 * Create template section
 */
export async function createTemplateSection(
  templateId: string,
  input: TemplateSectionInput
): Promise<TemplateSection> {
  const { data, error } = await supabase
    .from('product_detail_template_sections')
    .insert({
      template_id: templateId,
      title: input.title,
      content: input.content,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template section: ${error.message}`);
  }

  return data;
}

/**
 * Update template section
 */
export async function updateTemplateSection(
  id: string,
  input: Partial<TemplateSectionInput>
): Promise<TemplateSection> {
  const { data, error } = await supabase
    .from('product_detail_template_sections')
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update template section: ${error.message}`);
  }

  return data;
}

/**
 * Delete template section
 */
export async function deleteTemplateSection(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_detail_template_sections')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete template section: ${error.message}`);
  }
}

/**
 * Reorder template sections
 */
export async function reorderTemplateSections(
  templateId: string,
  sectionIds: string[]
): Promise<void> {
  // Update sort_order for each section based on its position in the array
  const updates = sectionIds.map((sectionId, index) =>
    supabase
      .from('product_detail_template_sections')
      .update({ sort_order: index })
      .eq('id', sectionId)
      .eq('template_id', templateId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(
      `Failed to reorder template sections: ${errors[0].error?.message}`
    );
  }
}
