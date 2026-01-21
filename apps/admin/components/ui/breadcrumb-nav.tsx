'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

/**
 * Route label mappings for human-readable breadcrumb labels
 */
const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  'products': 'Products',
  'new': 'New',
  'images': 'Images',
  'details': 'Details',
  'families': 'Product Families',
  'tags': 'Tags',
  'orders': 'Orders',
  'autoships': 'Autoships',
  'discounts': 'Discounts',
  'preview': 'Preview',
  'inventory': 'Inventory',
  'movements': 'Movements',
  'product-detail-templates': 'Product Templates',
};

/**
 * Check if a path segment is a dynamic ID (UUID or similar)
 */
function isDynamicSegment(segment: string): boolean {
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Also check for general IDs (long alphanumeric strings)
  const idPattern = /^[a-f0-9]{20,}$/i;
  return uuidPattern.test(segment) || idPattern.test(segment);
}

/**
 * Get a shortened display text for IDs
 */
function shortenId(id: string): string {
  return id.slice(0, 8) + '...';
}

interface BreadcrumbNavProps {
  /**
   * Optional custom label for dynamic segments (like product name)
   */
  dynamicLabel?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Automatic Breadcrumb Navigation Component
 *
 * Generates breadcrumbs based on the current URL path.
 * Supports dynamic segments (IDs) and custom labels.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <BreadcrumbNav />
 *
 * // With custom label for dynamic segment
 * <BreadcrumbNav dynamicLabel={product.name} />
 * ```
 */
export function BreadcrumbNav({ dynamicLabel, className }: BreadcrumbNavProps) {
  const pathname = usePathname();

  // Split path into segments and filter empty strings
  const segments = pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on root/dashboard
  if (segments.length === 0) {
    return null;
  }

  // Build breadcrumb items
  const items: { label: string; href: string; isLast: boolean }[] = [];

  // Add home/dashboard as first item
  items.push({
    label: 'Dashboard',
    href: '/',
    isLast: false,
  });

  // Build path progressively
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // Determine label
    let label: string;
    if (isDynamicSegment(segment)) {
      // Use custom label if provided for the last dynamic segment
      label = isLast && dynamicLabel ? dynamicLabel : shortenId(segment);
    } else {
      label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    items.push({
      label,
      href: currentPath,
      isLast,
    });
  });

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="flex items-center gap-1">
                    {index === 0 && <Home className="h-4 w-4" />}
                    {index === 0 ? null : item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
