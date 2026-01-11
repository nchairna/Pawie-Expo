'use client';

import { AdminSidebar } from './admin-sidebar';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 md:ml-64">
        <div className="md:pt-0 pt-16">{children}</div>
      </main>
    </div>
  );
}
