/**
 * Cliente Supabase (solo clave anon).
 *
 * Sin VITE_* válidas la UI arranca en modo demo con un cliente placeholder
 * (sin persistir sesión). En producción usamos PKCE + refresh automático.
 * Nunca incluir service_role en el frontend.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function looksConfigured(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key) return false
  if (url.includes('YOUR_PROJECT_REF') || !url.startsWith('https://')) return false
  if (key.includes('YOUR_SUPABASE') || key.length < 20) return false
  return true
}

export const isSupabaseConfigured = looksConfigured(supabaseUrl, supabaseAnonKey)

function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    // Placeholder: permite revisar el shell sin .env (auth deshabilitada).
    return createClient<Database>('https://placeholder.supabase.co', 'public-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export const supabase = createSupabaseClient()
