import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.error(
    '[QuickConnect] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Auth and database features will not work. ' +
    'If deployed via GitHub Actions, add these as repository secrets.'
  )
}

/** No `Database` generic: avoids PostgREST "Processing node failed" / infinite recursion on complex selects. */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // @ts-expect-error GoTrue supports lockAcquireTimeout; createClient auth typings omit it.
      lockAcquireTimeout: 30_000,
    },
  }
)
