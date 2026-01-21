'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createTag } from '@/lib/tags';
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

const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required'),
  slug: z.string().optional(),
});

type CreateTagFormValues = z.infer<typeof createTagSchema>;

export default function NewTagPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateTagFormValues>({
    resolver: zodResolver(createTagSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  const onSubmit = async (values: CreateTagFormValues) => {
    setLoading(true);

    try {
      await createTag({
        name: values.name,
        slug: values.slug || undefined,
      });

      toast.success('Tag created successfully');
      router.push('/tags');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create tag';
      toast.error(errorMessage);
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-bold">Create New Tag</h1>
        <p className="text-muted-foreground mt-2">
          Create a new product tag for multi-category support
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tag Information</CardTitle>
          <CardDescription>
            Tags help organize products into multiple categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Dry Food, Chicken, Allergen Free"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for the tag
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., dry-food (auto-generated if empty)"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormDescription>
                      URL-friendly slug. Auto-generated from name if left empty.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Tag'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/tags')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}







