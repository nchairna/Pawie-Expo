/**
 * Product detail sections data access
 * Fetches sections for a product, merging template sections with product-specific overrides
 */

import { supabase } from './supabase';
import type { ProductDetailSection } from '@/components/product/ProductDetailAccordion';

/**
 * Get all detail sections for a product
 * Merges template sections with product-specific overrides
 * Returns sections sorted by sort_order
 */
export async function getProductDetailSections(
  productId: string
): Promise<ProductDetailSection[]> {
  // First, get the product to check if it has a template
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, detail_template_id, published')
    .eq('id', productId)
    .single();

  if (productError) {
    throw new Error(`Failed to fetch product: ${productError.message}`);
  }

  if (!product.published) {
    // Product not published, return empty array
    return [];
  }

  const sections: ProductDetailSection[] = [];
  const overrideMap = new Map<string, ProductDetailSection>();

  // Get product-specific sections (overrides and custom sections)
  const { data: productSections, error: productSectionsError } = await supabase
    .from('product_detail_sections')
    .select('id, template_section_id, title, content, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (productSectionsError) {
    throw new Error(
      `Failed to fetch product detail sections: ${productSectionsError.message}`
    );
  }

  // Build map of overrides by template_section_id
  if (productSections) {
    for (const section of productSections) {
      if (section.template_section_id) {
        // This is an override
        overrideMap.set(section.template_section_id, {
          id: section.id,
          title: section.title,
          content: section.content,
          sort_order: section.sort_order,
        });
      } else {
        // This is a custom section (not tied to template)
        sections.push({
          id: section.id,
          title: section.title,
          content: section.content,
          sort_order: section.sort_order,
        });
      }
    }
  }

  // If product has a template, get template sections
  if (product.detail_template_id) {
    const { data: templateSections, error: templateSectionsError } = await supabase
      .from('product_detail_template_sections')
      .select('id, title, content, sort_order')
      .eq('template_id', product.detail_template_id)
      .order('sort_order', { ascending: true });

    if (templateSectionsError) {
      throw new Error(
        `Failed to fetch template sections: ${templateSectionsError.message}`
      );
    }

    // Merge template sections with overrides
    if (templateSections) {
      for (const templateSection of templateSections) {
        const override = overrideMap.get(templateSection.id);
        if (override) {
          // Use override instead of template section
          sections.push(override);
        } else {
          // Use template section as-is
          sections.push({
            id: templateSection.id,
            title: templateSection.title,
            content: templateSection.content,
            sort_order: templateSection.sort_order,
          });
        }
      }
    }
  }

  // Sort all sections by sort_order
  sections.sort((a, b) => a.sort_order - b.sort_order);

  return sections;
}
