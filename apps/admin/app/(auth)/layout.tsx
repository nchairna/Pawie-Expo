/**
 * Auth Layout
 *
 * Simple centered layout for authentication pages (login, register).
 * No sidebar or header - just a clean centered card.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {children}
    </div>
  );
}
