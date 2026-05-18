import { createClient } from '@supabase/supabase-js';

// Hardcoded fallback so the app never crashes on missing env vars
const supabaseUrl =
  (import.meta.env?.VITE_SUPABASE_URL as string) ||
  'https://hunetmmhnbaizaqnycji.supabase.co';

const supabaseAnonKey =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bmV0bW1obmJhaXphcW55Y2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjQyMTIsImV4cCI6MjA5MjgwMDIxMn0.snjf6ea6xLS_xdg1GFJYRABAhuL0NwrnZfeeNnshKro';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
});

// Keep these exports so existing imports don't break
export const supabaseBase = supabase;
export function handleSupabaseError(error: any): Error {
  return error instanceof Error ? error : new Error(String(error?.message ?? 'Unknown error'));
}