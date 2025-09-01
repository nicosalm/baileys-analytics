import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: any; tokens: { access: string; refresh: string } }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('Login failed:', data.error || 'Invalid credentials')
        return false
      }
      
      if (data.accessToken && data.refreshToken) {
        localStorage.setItem('baileys_tokens', JSON.stringify({
          access: data.accessToken,
          refresh: data.refreshToken
        }))
        api.setAccessToken(data.accessToken)
        setState({
          status: 'authenticated',
          user: { id: data.userId, email: data.email, tenantId: data.tenantId },
          tokens: { access: data.accessToken, refresh: data.refreshToken }
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const signup = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      if (!response.ok) {
        return false
      }
      
      const data = await response.json()
      
      if (data.accessToken && data.refreshToken) {
        localStorage.setItem('baileys_tokens', JSON.stringify({
          access: data.accessToken,
          refresh: data.refreshToken
        }))
        api.setAccessToken(data.accessToken)
        setState({
          status: 'authenticated',
          user: { id: data.userId, email: data.email },
          tokens: { access: data.accessToken, refresh: data.refreshToken }
        })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = async () => {
    localStorage.removeItem('baileys_tokens')
    api.setAccessToken(null)
    setState({ status: 'unauthenticated' })
  }

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      return !error
    } catch {
      return false
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem('baileys_tokens')
      if (!stored) {
        setState({ status: 'unauthenticated' })
        return
      }
      
      try {
        const tokens = JSON.parse(stored)
        api.setAccessToken(tokens.access)
        
        // Verify token is still valid
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${tokens.access}` }
        })
        
        if (response.ok) {
          const user = await response.json()
          setState({
            status: 'authenticated',
            user,
            tokens
          })
        } else {
          localStorage.removeItem('baileys_tokens')
          setState({ status: 'unauthenticated' })
        }
      } catch {
        localStorage.removeItem('baileys_tokens')
        setState({ status: 'unauthenticated' })
      }
    }

    initAuth()
  }, [])


  return (
    <AuthContext.Provider value={{ state, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}
