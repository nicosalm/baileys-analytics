import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'baileys-auth',
    storage: window.localStorage
  }
})

export type AuthError = {
  message: string
  status?: number
}

export const handleAuthError = (error: any): AuthError => {
  if (error?.message) {
    return {
      message: error.message,
      status: error.status
    }
  }
  return {
    message: 'An unexpected error occurred',
    status: 500
  }
}