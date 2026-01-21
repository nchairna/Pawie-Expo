'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface Tab {
  name: string;
  href: string;
}

interface ProductTabsProps {
  productId: string;
}

export function ProductTabs({ productId }: ProductTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const tabs: Tab[] = [
    {
      name: 'Info',
      href: `/products/${productId}`,
    },
    {
      name: 'Images',
      href: `/products/${productId}/images`,
    },
    {
      name: 'Details',
      href: `/products/${productId}/details`,
    },
  ];

  const handleTabClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
      // Clear pending state after navigation completes
      setTimeout(() => setPendingHref(null), 300);
    });
  };

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const isLoading = pendingHref === tab.href;
          const showAsActive = isActive || isLoading;

          return (
            <a
              key={tab.name}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.href, e)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                showAsActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {tab.name}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
