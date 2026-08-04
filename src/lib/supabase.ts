import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Fincomer] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env',
  )
}

/**
 * Cliente Supabase.
 * Auth emite JWT (access_token) usado en cada request + RLS.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
