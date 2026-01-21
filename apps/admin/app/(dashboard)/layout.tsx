import { AdminSidebar } from '@/components/admin-sidebar';
import { BreadcrumbNav } from '@/components/ui/breadcrumb-nav';
import NextTopLoader from 'nextjs-toploader';

/**
 * Dashboard Layout
 *
 * Main application layout with sidebar navigation.
 * Applies to all admin pages except auth pages.
 *
 * Layout Structure:
 * - Sidebar: Fixed left navigation (desktop), mobile hamburger menu
 * - Breadcrumbs: Auto-generated from current path
 * - Main Content: Scrollable content area with padding
 * - Top Loading Bar: Shows progress during page navigation
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Top Loading Bar - appears during navigation */}
      <NextTopLoader
        color="hsl(var(--primary))"
        height={3}
        showSpinner={false}
        shadow="0 0 10px hsl(var(--primary)),0 0 5px hsl(var(--primary))"
      />

      {/* Sidebar - Fixed on desktop, hamburger on mobile */}
      <AdminSidebar />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64">
        {/* Add padding top on mobile for hamburger menu */}
        <div className="container mx-auto p-6 md:p-8 md:pt-8 pt-20">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNav className="mb-4" />

          {children}
        </div>
      </main>
    </div>
  );
}
