'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getTemplate,
  updateTemplate,
  getTemplateSections,
  createTemplateSection,
  updateTemplateSection,
  deleteTemplateSection,
  reorderTemplateSections,
  type ProductDetailTemplate,
  type TemplateSection,
  type TemplateSectionInput,
} from '@/lib/product-detail-templates';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const isNew = templateId === 'new';

  const [template, setTemplate] = useState<ProductDetailTemplate | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setTemplateName('');
      setTemplateDescription('');
      setSections([]);
      setLoading(false);
      return;
    }

    const loadTemplate = async () => {
      try {
        setLoading(true);
        const [templateData, sectionsData] = await Promise.all([
          getTemplate(templateId),
          getTemplateSections(templateId),
        ]);

        if (!templateData) {
          toast.error('Template not found');
          router.push('/product-detail-templates');
          return;
        }

        setTemplate(templateData);
        setTemplateName(templateData.name);
        setTemplateDescription(templateData.description || '');
        setSections(sectionsData);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load template';
        toast.error(message);
        router.push('/product-detail-templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [templateId, isNew, router]);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        // Create new template - redirect to edit page
        const { createTemplate } = await import('@/lib/product-detail-templates');
        const newTemplate = await createTemplate({
          name: templateName,
          description: templateDescription || null,
        });
        toast.success('Template created successfully');
        router.push(`/product-detail-templates/${newTemplate.id}`);
      } else {
        await updateTemplate(templateId, {
          name: templateName,
          description: templateDescription || null,
        });
        toast.success('Template updated successfully');
        // Reload template data
        const updated = await getTemplate(templateId);
        if (updated) {
          setTemplate(updated);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save template';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSectionDialog = (section?: TemplateSection) => {
    if (section) {
      setEditingSection(section);
      setSectionTitle(section.title);
      setSectionContent(section.content);
    } else {
      setEditingSection(null);
      setSectionTitle('');
      setSectionContent('');
    }
    setShowSectionDialog(true);
  };

  const handleSaveSection = async () => {
    if (!sectionTitle.trim()) {
      toast.error('Section title is required');
      return;
    }

    if (isNew || !templateId) {
      toast.error('Please save the template first');
      return;
    }

    try {
      if (editingSection) {
        await updateTemplateSection(editingSection.id, {
          title: sectionTitle,
          content: sectionContent,
        });
        toast.success('Section updated successfully');
      } else {
        await createTemplateSection(templateId, {
          title: sectionTitle,
          content: sectionContent,
          sort_order: sections.length,
        });
        toast.success('Section created successfully');
      }

      setShowSectionDialog(false);
      // Reload sections
      const updatedSections = await getTemplateSections(templateId);
      setSections(updatedSections);
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
      setDeletingSectionId(sectionId);
      await deleteTemplateSection(sectionId);
      toast.success('Section deleted successfully');
      // Reload sections
      const updatedSections = await getTemplateSections(templateId);
      setSections(updatedSections);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete section';
      toast.error(message);
    } finally {
      setDeletingSectionId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/product-detail-templates"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? 'New Template' : template?.name || 'Edit Template'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isNew
                ? 'Create a new product detail template'
                : 'Edit template details and sections'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Template Details */}
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              Basic information about this template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Food Template, Bed Template"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Template Sections */}
        {!isNew && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Template Sections</CardTitle>
                  <CardDescription>
                    Define sections that will be available for products using this template
                  </CardDescription>
                </div>
                <Button onClick={() => handleOpenSectionDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No sections yet. Add your first section to get started.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {sections.map((section) => (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger>{section.title}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: section.content || '<p>No content</p>' }}
                          />
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSectionDialog(section)}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSection(section.id)}
                              disabled={deletingSectionId === section.id}>
                              {deletingSectionId === section.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}
      </div>

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
                : 'Add a new section to this template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="section-title">Title *</Label>
              <Input
                id="section-title"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g., Details, Ingredients, Feeding Instructions"
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
