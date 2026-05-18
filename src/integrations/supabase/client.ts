import { supabase } from '../../lib/supabase';

// Re-export the single supabase instance
export { supabase };

// Helper to check auth status
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// Helper to get current user
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}
