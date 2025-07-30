import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, User, AuthResponse } from '@/lib/api'

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; tokens: { access: string; refresh: string } }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

const TOKEN_KEY = 'baileys_tokens'

const loadTokens = (): { access: string; refresh: string } | null => {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

const saveTokens = (access: string, refresh: string) => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access, refresh }))
}

const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const handleAuthResponse = async (response: AuthResponse) => {
    const { accessToken, refreshToken } = response
    saveTokens(accessToken, refreshToken)
    api.setAccessToken(accessToken)

    const userResult = await api.me()
    if (userResult.success) {
      setState({
        status: 'authenticated',
        user: userResult.data,
        tokens: { access: accessToken, refresh: refreshToken }
      })
      return true
    }

    return false
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await api.login(email, password)
    if (result.success) {
      return handleAuthResponse(result.data)
    }
    return false
  }

  const signup = async (email: string, password: string): Promise<boolean> => {
    const result = await api.signup(email, password)
    if (result.success) {
      return handleAuthResponse(result.data)
    }
    return false
  }

  const logout = async () => {
    if (state.status === 'authenticated') {
      await api.logout()
    }
    clearTokens()
    api.setAccessToken(null)
    setState({ status: 'unauthenticated' })
  }

  useEffect(() => {
    const initAuth = async () => {
      const tokens = loadTokens()
      if (!tokens) {
        setState({ status: 'unauthenticated' })
        return
      }

      api.setAccessToken(tokens.access)
      const userResult = await api.me()

      if (userResult.success) {
        setState({
          status: 'authenticated',
          user: userResult.data,
          tokens
        })
      } else if (userResult.status === 401) {
        const refreshResult = await api.refresh(tokens.refresh)
        if (refreshResult.success) {
          await handleAuthResponse(refreshResult.data)
        } else {
          clearTokens()
          setState({ status: 'unauthenticated' })
        }
      } else {
        setState({ status: 'unauthenticated' })
      }
    }

    initAuth()
  }, [])

  // Auto-refresh token before expiry
  useEffect(() => {
    if (state.status === 'authenticated') {
      const timer = setTimeout(async () => {
        const refreshResult = await api.refresh(state.tokens.refresh)
        if (refreshResult.success) {
          await handleAuthResponse(refreshResult.data)
        }
      }, 14 * 60 * 1000) // 14 minutes (token expires at 15)

      return () => clearTimeout(timer)
    }
  }, [state])

  return (
    <AuthContext.Provider value={{ state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
