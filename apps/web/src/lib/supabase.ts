import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

// create a custom storage adapter that handles production environments better
const customStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key)
    } catch (error) {
      console.warn('localStorage.getItem failed:', error)
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value)
    } catch (error) {
      console.warn('localStorage.setItem failed:', error)
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      console.warn('localStorage.removeItem failed:', error)
    }
  }
}

// ensure we only create one instance of the supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null

if (!supabaseInstance) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'baileys-auth',
      storage: customStorage,
      debug: import.meta.env.DEV // only enable debug in development
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