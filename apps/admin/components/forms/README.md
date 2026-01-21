# Reusable Form Components

This directory contains reusable form components designed to work seamlessly with react-hook-form and shadcn/ui components throughout the admin dashboard.

## Components

### 1. ImageUpload

A powerful image upload component with drag-drop support, preview, and progress tracking.

**Features:**
- Drag and drop file upload
- Multiple file selection
- File validation (type and size)
- Upload progress tracking
- Image preview grid
- Remove uploaded images
- Works with react-hook-form

**Basic Usage:**

```tsx
import { ImageUpload } from '@/components/forms';

function MyForm() {
  const [images, setImages] = useState<string[]>([]);

  return (
    <ImageUpload
      value={images}
      onUpload={async (file) => {
        const url = await uploadImageToSupabase(file);
        setImages([...images, url]);
      }}
      onRemove={(url) => {
        setImages(images.filter(img => img !== url));
      }}
      multiple
    />
  );
}
```

**With react-hook-form:**

```tsx
import { useForm } from 'react-hook-form';
import { ImageUpload } from '@/components/forms';

function ProductForm() {
  const form = useForm({
    defaultValues: {
      images: [],
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="images"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Product Images</FormLabel>
            <FormControl>
              <ImageUpload
                value={field.value}
                onUpload={async (file) => {
                  const url = await uploadImage(file);
                  field.onChange([...field.value, url]);
                }}
                onRemove={(url) => {
                  field.onChange(field.value.filter(v => v !== url));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string[]` | `[]` | Current image URLs to display |
| `onUpload` | `(file: File) => Promise<void>` | - | Called when a file is uploaded |
| `onRemove` | `(url: string) => void` | - | Called when an image is removed |
| `multiple` | `boolean` | `true` | Allow multiple file selection |
| `maxSize` | `number` | `5242880` | Max file size in bytes (5MB default) |
| `accept` | `string` | `'image/jpeg,image/png,image/webp,image/gif'` | Accepted file types |
| `disabled` | `boolean` | `false` | Disable the component |
| `showProgress` | `boolean` | `true` | Show upload progress |
| `onError` | `(error: Error) => void` | - | Error handler |

---

### 2. TagMultiSelect

A multi-select component for selecting product tags with search functionality.

**Features:**
- Search/filter tags
- Multi-select with visual feedback
- Selected tags display with badges
- Maximum selection limit
- Clear all functionality
- Works with react-hook-form

**Basic Usage:**

```tsx
import { TagMultiSelect } from '@/components/forms';
import { getTags } from '@/lib/tags';

function MyForm() {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    getTags().then(setTags);
  }, []);

  return (
    <TagMultiSelect
      tags={tags}
      value={selectedTagIds}
      onChange={setSelectedTagIds}
    />
  );
}
```

**With react-hook-form:**

```tsx
import { useForm } from 'react-hook-form';
import { TagMultiSelect } from '@/components/forms';

function ProductForm() {
  const [tags, setTags] = useState<ProductTag[]>([]);

  const form = useForm({
    defaultValues: {
      tag_ids: [],
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="tag_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Product Tags</FormLabel>
            <FormControl>
              <TagMultiSelect
                tags={tags}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Select tags for multi-category support
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tags` | `ProductTag[]` | - | Available tags to select from |
| `value` | `string[]` | `[]` | Selected tag IDs |
| `onChange` | `(tagIds: string[]) => void` | - | Called when selection changes |
| `disabled` | `boolean` | `false` | Disable the component |
| `showSearch` | `boolean` | `true` | Show search input |
| `maxTags` | `number` | - | Maximum number of tags that can be selected |
| `searchPlaceholder` | `string` | `'Search tags...'` | Placeholder for search input |
| `emptyMessage` | `string` | `'No tags available...'` | Message when no tags exist |
| `noResultsMessage` | `string` | `'No tags found...'` | Message when search returns no results |

---

### 3. ProductSelector

A product selector with search and modal interface for single or multiple product selection.

**Features:**
- Modal interface for product selection
- Search by name, SKU, or category
- Single or multiple selection modes
- Product preview with images
- Published/unpublished filtering
- Maximum selection limit
- Works with react-hook-form

**Basic Usage (Single Selection):**

```tsx
import { ProductSelector } from '@/components/forms';
import { getProducts } from '@/lib/products';

function DiscountForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  return (
    <ProductSelector
      products={products}
      value={selectedProductId}
      onChange={setSelectedProductId}
    />
  );
}
```

**Multiple Selection:**

```tsx
import { ProductSelector } from '@/components/forms';

function DiscountTargetsForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  return (
    <ProductSelector
      products={products}
      value={selectedProductIds}
      onChange={setSelectedProductIds}
      multiple
      maxProducts={10}
      publishedOnly
    />
  );
}
```

**With react-hook-form:**

```tsx
import { useForm } from 'react-hook-form';
import { ProductSelector } from '@/components/forms';

function DiscountTargetsForm() {
  const [products, setProducts] = useState<Product[]>([]);

  const form = useForm({
    defaultValues: {
      product_ids: [],
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="product_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Target Products</FormLabel>
            <FormControl>
              <ProductSelector
                products={products}
                value={field.value}
                onChange={field.onChange}
                multiple
                publishedOnly
                modalTitle="Select Discount Target Products"
                modalDescription="Choose which products this discount applies to"
              />
            </FormControl>
            <FormDescription>
              Select products for this discount. Leave empty to apply to all products.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `products` | `Product[]` | - | Available products to select from |
| `value` | `string \| string[] \| null` | - | Selected product ID(s) |
| `onChange` | `(value: string \| string[] \| null) => void` | - | Called when selection changes |
| `multiple` | `boolean` | `false` | Enable multiple product selection |
| `disabled` | `boolean` | `false` | Disable the component |
| `placeholder` | `string` | `'Select product(s)...'` | Placeholder text |
| `modalTitle` | `string` | `'Select Products'` | Modal title |
| `modalDescription` | `string` | `'Search and select products'` | Modal description |
| `maxProducts` | `number` | - | Maximum number of products (multiple mode) |
| `publishedOnly` | `boolean` | `false` | Filter to show only published products |
| `emptyMessage` | `string` | `'No products available'` | Message when no products exist |
| `noResultsMessage` | `string` | `'No products found...'` | Message when search returns no results |

---

## Design Principles

All form components follow these principles:

1. **react-hook-form Compatible**: All components work seamlessly with FormField and form control patterns
2. **Controlled Components**: Use `value` and `onChange` props for full control
3. **Accessible**: Proper ARIA labels, keyboard navigation, and focus management
4. **Loading States**: Handle async operations with loading indicators
5. **Error Handling**: Support validation and error display
6. **shadcn/ui Integration**: Use shadcn/ui components for consistent styling
7. **TypeScript First**: Full type safety with exported prop types

## Common Patterns

### Validation with Zod

```tsx
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  images: z.array(z.string()).min(1, 'At least one image is required'),
  tag_ids: z.array(z.string()).min(1, 'At least one tag is required'),
  product_ids: z.array(z.string()).optional(),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      images: [],
      tag_ids: [],
      product_ids: [],
    },
  });

  // Use FormField with components as shown above
}
```

### Loading States

```tsx
function MyForm() {
  const [loading, setLoading] = useState(false);

  return (
    <ImageUpload
      disabled={loading}
      onUpload={async (file) => {
        setLoading(true);
        try {
          await uploadImage(file);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
```

### Error Handling

```tsx
import { toast } from 'sonner';

function MyForm() {
  return (
    <ImageUpload
      onError={(error) => {
        toast.error(error.message);
      }}
      onUpload={async (file) => {
        try {
          await uploadImage(file);
          toast.success('Image uploaded successfully');
        } catch (error) {
          throw error; // Will trigger onError
        }
      }}
    />
  );
}
```

## Refactoring Existing Forms

When refactoring existing forms to use these components:

1. **Identify the pattern**: Look for inline tag selection, image upload, or product selection code
2. **Replace with component**: Import the appropriate component from `@/components/forms`
3. **Connect to form**: Use FormField if using react-hook-form
4. **Test validation**: Ensure form validation still works
5. **Remove old code**: Delete the replaced inline implementation

Example refactoring of tag selection in product-info-form.tsx:

**Before:**
```tsx
<div className="flex flex-wrap gap-2 p-4 border rounded-lg">
  {tags.map((tag) => (
    <button
      key={tag.id}
      onClick={() => handleToggle(tag.id)}
      className={selectedTagIds.includes(tag.id) ? 'selected' : ''}
    >
      {tag.name}
    </button>
  ))}
</div>
```

**After:**
```tsx
import { TagMultiSelect } from '@/components/forms';

<TagMultiSelect
  tags={tags}
  value={selectedTagIds}
  onChange={setSelectedTagIds}
  disabled={saving}
/>
```

## Testing

All components should be tested with:

1. **Unit tests**: Component behavior and props
2. **Integration tests**: Works with react-hook-form
3. **Accessibility tests**: Keyboard navigation and ARIA
4. **Visual tests**: Loading, empty, and error states

## Future Enhancements

Potential improvements for these components:

- [ ] Add drag-and-drop reordering for ImageUpload
- [ ] Add create new tag inline in TagMultiSelect
- [ ] Add product family grouping in ProductSelector
- [ ] Add bulk actions for all components
- [ ] Add export/import functionality
- [ ] Add advanced filtering options
- [ ] Add virtual scrolling for large lists
- [ ] Add custom validation rules support

## Contributing

When adding new reusable form components:

1. Follow the existing patterns and structure
2. Add comprehensive JSDoc documentation
3. Include usage examples in component comments
4. Add props table to this README
5. Ensure TypeScript type safety
6. Add loading, empty, and error states
7. Test with react-hook-form integration
