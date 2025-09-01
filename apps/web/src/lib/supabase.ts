import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ojpmtekljijcurgzrses.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcG10ZWtsamlqY3VyZ3pyc2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDM1NDgsImV4cCI6MjA3MjExOTU0OH0.BsXVCRxL_K0pjzPsfR0vXS6J5RxEKNVGPXm52Rm-kBs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
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