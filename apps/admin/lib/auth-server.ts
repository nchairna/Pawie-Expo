/**
 * Server-side authentication helpers
 * For use in Server Components and Server Actions only
 */

import { createClient } from './supabase-server';
import { redirect } from 'next/navigation';
import type { Profile } from './types';

/**
 * Require admin authentication for a Server Component or Server Action
 * Redirects to /login if not authenticated
 * Redirects to /forbidden if not an admin
 * Returns user and profile if admin
 */
export async function requireAdmin(): Promise<{
  user: { id: string; email?: string };
  profile: Profile;
}> {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user has admin role - select only needed columns
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    redirect('/login');
  }

  if (profile.role !== 'admin') {
    redirect('/forbidden');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as Profile,
  };
}

/**
 * Get current user profile (server-side)
 * Returns null if not authenticated
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile as Profile;
}

/**
 * Check if current user is admin (server-side)
 */
export async function isAdminServer(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin';
}
