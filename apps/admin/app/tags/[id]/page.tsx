'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getTag, updateTag, deleteTag } from '@/lib/tags';
import type { ProductTag } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const updateTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required'),
  slug: z.string().min(1, 'Slug is required'),
});

type UpdateTagFormValues = z.infer<typeof updateTagSchema>;

export default function EditTagPage() {
  const router = useRouter();
  const params = useParams();
  const tagId = params.id as string;

  const [tag, setTag] = useState<ProductTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateTagFormValues>({
    resolver: zodResolver(updateTagSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  // Fetch tag data
  useEffect(() => {
    async function fetchTag() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTag(tagId);
        setTag(data);
        form.reset({
          name: data.name,
          slug: data.slug,
        });
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load tag';
        setError(errorMessage);
        if (err.message === 'Tag not found') {
          toast.error('Tag not found');
          setTimeout(() => {
            router.push('/tags');
          }, 2000);
        } else {
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    if (tagId) {
      fetchTag();
    }
  }, [tagId, form, router]);

  const handleSave = async (values: UpdateTagFormValues) => {
    if (!tag) return;

    setSaving(true);
    try {
      const updated = await updateTag(tag.id, {
        name: values.name,
        slug: values.slug,
      });
      setTag(updated);
      toast.success('Tag updated successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update tag';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tag) return;
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"?`)) {
      return;
    }

    try {
      await deleteTag(tag.id);
      toast.success('Tag deleted successfully');
      router.push('/tags');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tag');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading tag...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !tag) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push('/tags')}>
            Back to Tags
          </Button>
        </div>
      </div>
    );
  }

  if (!tag) {
    return null;
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/tags"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tags
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{tag.name}</h1>
            <p className="text-muted-foreground mt-2">
              Edit tag information
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tag Information</CardTitle>
          <CardDescription>
            Update tag name and slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter tag name"
                        {...field}
                        disabled={saving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., dry-food"
                        {...field}
                        disabled={saving}
                      />
                    </FormControl>
                    <FormDescription>
                      URL-friendly slug (must be unique)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 pt-4 border-t">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete Tag
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}







