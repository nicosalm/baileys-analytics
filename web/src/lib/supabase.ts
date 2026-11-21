import { AuthClient } from '@supabase/auth-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
  )
}

// the browser uses supabase for sign-in only (all data goes through the worker), so this is the
// auth client alone, built the way supabase-js builds it, without the rest of that bundle
export const createSupabaseAuth = ({ autoRefreshToken }: { autoRefreshToken: boolean }) =>
  new AuthClient({
    url: `${supabaseUrl}/auth/v1`,
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
    autoRefreshToken,
    persistSession: true,
    detectSessionInUrl: false, // Disabled - we handle code exchange manually in AuthCallback
    flowType: 'pkce',
    storageKey: 'baileys-auth',
  })

export const supabaseAuth = createSupabaseAuth({ autoRefreshToken: true })

// helper to clear stale auth data
export const clearAuthStorage = () => {
  try {
    // clear all auth-related localStorage items
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('baileys-auth') || key.includes('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear auth storage:', error)
  }
}
