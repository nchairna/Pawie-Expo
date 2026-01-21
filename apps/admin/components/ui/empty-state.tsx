import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  /**
   * Lucide icon to display
   */
  icon: LucideIcon;
  /**
   * Main heading text
   */
  title: string;
  /**
   * Description text explaining the empty state
   */
  description: string;
  /**
   * Optional CTA button configuration
   */
  action?: {
    /**
     * Button label text
     */
    label: string;
    /**
     * Either href for navigation or onClick for action
     */
    href?: string;
    onClick?: () => void;
  };
}

/**
 * Empty State Component - Displays when no data is available
 *
 * Shows a centered icon, title, description, and optional call-to-action button.
 * Use this for empty lists, search results with no matches, or filtered views with no data.
 *
 * @example
 * ```tsx
 * // With navigation link
 * <EmptyState
 *   icon={Package}
 *   title="No products found"
 *   description="Get started by creating your first product"
 *   action={{
 *     label: "Create Product",
 *     href: "/products/new"
 *   }}
 * />
 *
 * // With action handler
 * <EmptyState
 *   icon={Search}
 *   title="No results found"
 *   description="Try adjusting your search or filters"
 *   action={{
 *     label: "Clear Filters",
 *     onClick: () => resetFilters()
 *   }}
 * />
 *
 * // Without action button
 * <EmptyState
 *   icon={ShoppingCart}
 *   title="No orders yet"
 *   description="Orders will appear here once customers start placing them"
 * />
 * ```
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Icon */}
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>

      {/* Description */}
      <p className="mb-6 text-sm text-muted-foreground max-w-sm">{description}</p>

      {/* Optional CTA Button */}
      {action && (
        <>
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </>
      )}
    </div>
  );
}
