import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardShortcutsProvider } from "@/components/ui/keyboard-shortcuts";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pawie Admin",
  description: "Admin panel for Pawie pet commerce platform",
};

/**
 * Root Layout
 *
 * Minimal root layout that only handles:
 * - Font configuration
 * - Global styles
 * - Toast notifications
 * - Keyboard shortcuts
 *
 * Layout structure is managed by route groups:
 * - (auth)/layout.tsx - Centered layout for login/register
 * - (dashboard)/layout.tsx - Sidebar + content for admin pages
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <KeyboardShortcutsProvider>
          {children}
        </KeyboardShortcutsProvider>
        <Toaster />
      </body>
    </html>
  );
}
