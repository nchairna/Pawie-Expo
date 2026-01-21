# DataTable Component Library

Reusable, type-safe table components for displaying data in the admin dashboard.

## Components

### DataTable

Generic table component with type-safe column definitions, row click handlers, and empty state support.

**Props:**
- `data: T[]` - Array of data to display
- `columns: Column<T>[]` - Column definitions
- `keyExtractor: (item: T) => string` - Function to extract unique key from each row
- `onRowClick?: (item: T) => void` - Optional row click handler
- `emptyState?` - Optional empty state configuration with icon, title, description, and action
- `className?` - Optional className for the table container

**Example:**
```tsx
import { DataTable, Column } from '@/components/data-table';
import { Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
}

const columns: Column<Product>[] = [
  {
    header: 'Name',
    accessor: (product) => product.name,
  },
  {
    header: 'Price',
    accessor: (product) => `$${product.price}`,
    className: 'text-right',
    headerClassName: 'text-right',
  },
];

<DataTable
  data={products}
  columns={columns}
  keyExtractor={(product) => product.id}
  onRowClick={(product) => router.push(`/products/${product.id}`)}
  emptyState={{
    icon: Package,
    title: 'No products found',
    description: 'Get started by creating your first product',
    action: {
      label: 'New Product',
      href: '/products/new'
    }
  }}
/>
```

### DataTableSkeleton

Loading skeleton for DataTable with animated placeholders.

**Props:**
- `columnCount?: number` - Number of columns (default: 5)
- `rowCount?: number` - Number of rows (default: 10)
- `showActions?: boolean` - Whether to show actions column (default: true)

**Example:**
```tsx
import { DataTableSkeleton } from '@/components/data-table';

<Suspense fallback={<DataTableSkeleton columnCount={5} rowCount={10} />}>
  <ProductsTable />
</Suspense>
```

### DataTablePagination

Pagination controls that work with URL searchParams for server-side pagination.

**Props:**
- `currentPage: number` - Current page number (1-indexed)
- `totalPages: number` - Total number of pages
- `total?: number` - Total number of items (optional, for display)
- `basePath?: string` - Optional base path for pagination links

**Example:**
```tsx
import { DataTablePagination } from '@/components/data-table';

<DataTablePagination
  currentPage={2}
  totalPages={10}
  total={100}
/>
```

## Column Definition

The `Column<T>` interface defines how each column should be rendered:

```typescript
interface Column<T> {
  header: string;              // Column header text
  accessor: (item: T) => React.ReactNode;  // Function to render cell content
  className?: string;          // Optional className for table cells
  headerClassName?: string;    // Optional className for header cell
}
```

**Tips:**
- Use `accessor` to transform data or return JSX elements (badges, buttons, etc.)
- Use `className` and `headerClassName` to align content (e.g., `text-right` for numbers)
- Return `<span className="text-muted-foreground">—</span>` for empty values

## Architecture

**Component Hierarchy:**
```
DataTable (Client Component - for row click handling)
  └── shadcn/ui Table components
       └── Column accessors render content
```

**Data Flow:**
1. Server Component fetches data
2. Pass data to DataTable as props
3. DataTable maps over data and calls column accessors
4. Column accessors transform data into renderable content

**Key Design Decisions:**
- Generic typing ensures type safety across the entire table
- Column definitions use accessor functions for maximum flexibility
- Empty state is optional and uses existing EmptyState component
- Pagination preserves URL searchParams for shareable URLs
- Skeleton matches the table structure for smooth loading UX

## Examples

### Simple Table with Actions

```tsx
const columns: Column<Product>[] = [
  {
    header: 'Name',
    accessor: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    header: 'Price',
    accessor: (p) => formatPrice(p.price),
    className: 'text-right',
  },
  {
    header: 'Actions',
    accessor: (p) => (
      <Button onClick={() => handleEdit(p)}>Edit</Button>
    ),
    className: 'text-right',
  },
];
```

### Table with Complex Cell Rendering

```tsx
const columns: Column<Order>[] = [
  {
    header: 'Order ID',
    accessor: (order) => (
      <span className="font-mono text-sm">{truncate(order.id)}</span>
    ),
  },
  {
    header: 'Status',
    accessor: (order) => (
      <Badge className={getStatusColor(order.status)}>
        {order.status}
      </Badge>
    ),
  },
  {
    header: 'Total',
    accessor: (order) => (
      <span className="font-medium">{formatCurrency(order.total)}</span>
    ),
    className: 'text-right',
  },
];
```

### Server Component with Suspense

```tsx
async function ProductsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const resolvedParams = await searchParams;

  return (
    <div>
      <h1>Products</h1>

      <Suspense fallback={<DataTableSkeleton columnCount={4} />}>
        <ProductsContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}

async function ProductsContent({ searchParams }: ContentProps) {
  const result = await getProducts(searchParams);

  return (
    <>
      <DataTable
        data={result.data}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => router.push(`/products/${p.id}`)}
      />
      <DataTablePagination
        currentPage={result.currentPage}
        totalPages={result.pages}
        total={result.total}
      />
    </>
  );
}
```

## Migration Guide

To migrate existing tables to use DataTable:

1. **Extract column definitions:**
   - Identify table headers
   - Create `Column<T>[]` array
   - Use `accessor` functions to extract/render cell content

2. **Replace Table markup:**
   - Remove manual `<Table>`, `<TableRow>`, etc.
   - Replace with `<DataTable>` component

3. **Add empty state:**
   - Use `emptyState` prop instead of conditional rendering
   - Specify icon, title, description, and optional action

4. **Update pagination:**
   - Replace custom pagination with `<DataTablePagination>`
   - Pass `currentPage`, `totalPages`, and `total`

5. **Update loading state:**
   - Replace `<TableSkeleton>` with `<DataTableSkeleton>`

## Performance Notes

- DataTable is a Client Component for row click handling
- All data fetching should happen in Server Components
- Column accessors are called during render - keep them fast
- Use `React.memo` for expensive column renderers if needed
- Pagination uses URL params for server-side pagination (no client-side state)

## Related Components

- `components/ui/table.tsx` - Base shadcn/ui Table components
- `components/ui/empty-state.tsx` - Empty state component used by DataTable
- `components/ui/skeleton.tsx` - Skeleton component used by DataTableSkeleton
