'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  key: string;
  description: string;
  action?: () => void;
}

const shortcuts: Shortcut[] = [
  { key: 'g h', description: 'Go to Dashboard' },
  { key: 'g p', description: 'Go to Products' },
  { key: 'g o', description: 'Go to Orders' },
  { key: 'g i', description: 'Go to Inventory' },
  { key: 'g a', description: 'Go to Autoships' },
  { key: '/', description: 'Focus search' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close dialog / Clear selection' },
];

/**
 * Global keyboard shortcuts provider
 * Handles navigation and common actions
 */
export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        // Allow escape to blur input
        if (event.key === 'Escape') {
          (event.target as HTMLElement).blur();
        }
        return;
      }

      const key = event.key.toLowerCase();

      // Handle two-key shortcuts (g + letter)
      if (pendingKey === 'g') {
        setPendingKey(null);
        switch (key) {
          case 'h':
            router.push('/');
            break;
          case 'p':
            router.push('/products');
            break;
          case 'o':
            router.push('/orders');
            break;
          case 'i':
            router.push('/inventory');
            break;
          case 'a':
            router.push('/autoships');
            break;
        }
        return;
      }

      // Start two-key sequence
      if (key === 'g') {
        setPendingKey('g');
        // Clear after timeout
        setTimeout(() => setPendingKey(null), 1000);
        return;
      }

      // Single key shortcuts
      switch (key) {
        case '/':
          event.preventDefault();
          // Focus the first search input on the page
          const searchInput = document.querySelector(
            'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
          ) as HTMLInputElement | null;
          if (searchInput) {
            searchInput.focus();
          }
          break;

        case '?':
          event.preventDefault();
          setIsOpen(true);
          break;

        case 'escape':
          setIsOpen(false);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, pendingKey]);

  return (
    <>
      {children}
      <KeyboardShortcutsDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

/**
 * Keyboard shortcuts dialog
 */
function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate quickly through the admin dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Navigation</h4>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => s.key.startsWith('g '))
                .map((shortcut) => (
                  <ShortcutRow key={shortcut.key} shortcut={shortcut} />
                ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Actions</h4>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => !s.key.startsWith('g '))
                .map((shortcut) => (
                  <ShortcutRow key={shortcut.key} shortcut={shortcut} />
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{shortcut.description}</span>
      <div className="flex gap-1">
        {shortcut.key.split(' ').map((k, i) => (
          <kbd
            key={i}
            className="px-2 py-1 bg-muted rounded text-xs font-mono border"
          >
            {k === '/' ? '/' : k.toUpperCase()}
          </kbd>
        ))}
      </div>
    </div>
  );
}

/**
 * Button to open keyboard shortcuts dialog
 */
export function KeyboardShortcutsButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Keyboard className="h-4 w-4" />
        <span className="hidden sm:inline">Shortcuts</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 bg-muted rounded text-xs font-mono border">
          ?
        </kbd>
      </Button>
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
