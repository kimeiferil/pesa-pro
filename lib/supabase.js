import { createClient } from '@supabase/supabase-js'

// Fallback values for development
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hunetmmhnbaizaqnycji.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bmV0bW1obmJhaXphcW55Y2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjQyMTIsImV4cCI6MjA5MjgwMDIxMn0.snjf6ea6xLS_xdg1GFJYRABAhuL0NwrnZfeeNnshKro'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
