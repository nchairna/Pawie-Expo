'use client';

import { usePathname } from 'next/navigation';
import { AdminLayout } from './admin-layout';

// Pages that should NOT have the sidebar
const noSidebarPages = ['/login', '/register', '/forbidden'];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldShowSidebar = !noSidebarPages.includes(pathname || '');

  if (shouldShowSidebar) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return <>{children}</>;
}
