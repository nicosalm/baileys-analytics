import type { AuthState } from '@/contexts/auth'

// a demo visitor holds an anonymous session but has no account. only real accounts count as
// signed in: they see Log out, and the login page sends them on to the dashboard.
export const hasAccount = (state: AuthState): boolean => state.status === 'authenticated' && state.user.isDemo !== true

export const isDemoSession = (state: AuthState): boolean => state.status === 'authenticated' && state.user.isDemo === true
