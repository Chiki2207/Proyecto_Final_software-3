import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.error(
    '[Fincomer] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Configúralas en Vercel → Settings → Environment Variables y vuelve a desplegar.',
  )
}

/**
 * Cliente Supabase.
 * Auth emite JWT (access_token) usado en cada request + RLS.
 * Si faltan env vars no lanzamos excepción (evita pantalla en blanco en Vercel).
 */
export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel y redeploy.',
          )
        },
      },
    ) as SupabaseClient)
