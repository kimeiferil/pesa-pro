import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    '[Pesa Pro] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from .env.\n' +
    'Copy .env.example to .env and fill in your Supabase project credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,   // Capacitor handles deep links differently
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

export type Database = {
  public: {
    Tables: {
      transactions:      { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      categories:        { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      budgets:           { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      groups:            { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      group_members:     { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      group_transactions:{ Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      savings_goals:     { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      debts:             { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      profiles:         { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      businesses:       { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      business_members: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      roles:            { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      member_roles:     { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      products:         { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      sales:            { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      sale_items:       { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      suppliers:        { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      inventory_purchases:      { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      inventory_purchase_items: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
  }
}
