import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

let supabaseInstance: ReturnType<typeof createClient> | null = null

if (!supabaseInstance) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disabled - we handle code exchange manually in AuthCallback
      flowType: 'pkce',
      storageKey: 'baileys-auth',
    }
  })
}

export const supabase = supabaseInstance

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
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear auth storage:', error)
  }
}