'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getTemplates,
  getTemplateSections,
  setProductTemplate,
  getProductDetailSections,
  upsertProductSection,
  deleteProductSection,
  type ProductDetailTemplate,
  type ProductDetailSection,
} from '@/lib/product-details';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';

interface ProductDetailsManagerProps {
  productId: string;
  product: Product | null;
}

export function ProductDetailsManager({
  productId,
  product,
}: ProductDetailsManagerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProductDetailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    product?.detail_template_id || null
  );
  const [templateSections, setTemplateSections] = useState<any[]>([]);
  const [productSections, setProductSections] = useState<ProductDetailSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<ProductDetailSection | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [sectionTemplateId, setSectionTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [templatesData, sectionsData] = await Promise.all([
          getTemplates(),
          getProductDetailSections(productId),
        ]);

        setTemplates(templatesData);
        setProductSections(sectionsData);

        // Get product's current template
        if (product?.detail_template_id) {
          setSelectedTemplateId(product.detail_template_id);
          const templateSectionsData = await getTemplateSections(
            product.detail_template_id
          );
          setTemplateSections(templateSectionsData);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load data';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId, product?.detail_template_id]);

  const handleTemplateChange = async (templateId: string | null) => {
    try {
      setSaving(true);
      await setProductTemplate(productId, templateId);
      setSelectedTemplateId(templateId);

      if (templateId) {
        const sections = await getTemplateSections(templateId);
        setTemplateSections(sections);
      } else {
        setTemplateSections([]);
      }

      toast.success('Template updated successfully');
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update template';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSectionDialog = (section?: ProductDetailSection) => {
    if (section) {
      setEditingSection(section);
      setSectionTitle(section.title);
      setSectionContent(section.content);
      setSectionTemplateId(section.template_section_id);
    } else {
      setEditingSection(null);
      setSectionTitle('');
      setSectionContent('');
      setSectionTemplateId(null);
    }
    setShowSectionDialog(true);
  };

  const handleSaveSection = async () => {
    if (!sectionTitle.trim()) {
      toast.error('Section title is required');
      return;
    }

    try {
      await upsertProductSection(
        productId,
        editingSection?.id || null,
        {
          title: sectionTitle,
          content: sectionContent,
          template_section_id: sectionTemplateId,
        }
      );
      toast.success(
        editingSection ? 'Section updated successfully' : 'Section created successfully'
      );
      setShowSectionDialog(false);
      // Reload sections
      const updated = await getProductDetailSections(productId);
      setProductSections(updated);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save section';
      toast.error(message);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section?')) {
      return;
    }

    try {
      await deleteProductSection(sectionId);
      toast.success('Section deleted successfully');
      const updated = await getProductDetailSections(productId);
      setProductSections(updated);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete section';
      toast.error(message);
    }
  };

  // Build merged sections view (template sections + overrides + custom)
  const mergedSections = useMemo(() => {
    const overrideMap = new Map<string, ProductDetailSection>();
    const customSections: ProductDetailSection[] = [];

    productSections.forEach((section) => {
      if (section.template_section_id) {
        overrideMap.set(section.template_section_id, section);
      } else {
        customSections.push(section);
      }
    });

    const result: Array<{
      id: string;
      title: string;
      content: string;
      isOverride: boolean;
      isCustom: boolean;
      productSectionId?: string;
    }> = [];

    // Add template sections (with overrides if any)
    templateSections.forEach((templateSection) => {
      const override = overrideMap.get(templateSection.id);
      result.push({
        id: templateSection.id,
        title: override?.title || templateSection.title,
        content: override?.content || templateSection.content,
        isOverride: !!override,
        isCustom: false,
        productSectionId: override?.id,
      });
    });

    // Add custom sections
    customSections.forEach((section) => {
      result.push({
        id: section.id,
        title: section.title,
        content: section.content,
        isOverride: false,
        isCustom: true,
        productSectionId: section.id,
      });
    });

    return result;
  }, [templateSections, productSections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Template Assignment</CardTitle>
          <CardDescription>
            Assign a template to this product, or leave blank for custom sections only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedTemplateId || '__none__'}
            onValueChange={(value) =>
              handleTemplateChange(value === '__none__' ? null : value)
            }
            disabled={saving}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (Custom Sections Only)</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Detail Sections</CardTitle>
              <CardDescription>
                {selectedTemplateId
                  ? 'Override template sections or add custom sections'
                  : 'Add custom sections for this product'}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenSectionDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mergedSections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sections yet.</p>
              {selectedTemplateId && (
                <p className="text-sm mt-2">
                  Template sections will appear here. You can override them or add custom sections.
                </p>
              )}
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {mergedSections.map((section) => (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{section.title}</span>
                      {section.isOverride && (
                        <span className="text-xs text-muted-foreground">(Override)</span>
                      )}
                      {section.isCustom && (
                        <span className="text-xs text-muted-foreground">(Custom)</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: section.content || '<p>No content</p>',
                        }}
                      />
                      {section.productSectionId && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const productSection = productSections.find(
                                (s) => s.id === section.productSectionId
                              );
                              if (productSection) {
                                handleOpenSectionDialog(productSection);
                              }
                            }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (section.productSectionId) {
                                handleDeleteSection(section.productSectionId);
                              }
                            }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      )}
                      {!section.productSectionId && section.isOverride === false && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Create override
                              const templateSection = templateSections.find(
                                (ts) => ts.id === section.id
                              );
                              if (templateSection) {
                                handleOpenSectionDialog();
                                setSectionTemplateId(templateSection.id);
                                setSectionTitle(templateSection.title);
                                setSectionContent(templateSection.content);
                              }
                            }}>
                            Override This Section
                          </Button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Section Edit Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Edit Section' : 'New Section'}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? 'Update the section title and content'
                : 'Add a new section for this product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="section-title">Title *</Label>
              <Input
                id="section-title"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g., Details, Ingredients, Size"
              />
            </div>
            <div>
              <Label htmlFor="section-content">Content (HTML) *</Label>
              <textarea
                id="section-content"
                value={sectionContent}
                onChange={(e) => setSectionContent(e.target.value)}
                placeholder="Enter HTML content for this section..."
                className="w-full min-h-[200px] px-3 py-2 border rounded-md font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML content will be rendered on product detail pages
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection}>Save Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
