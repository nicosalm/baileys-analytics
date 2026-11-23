import { describe, it, expect } from 'vitest'
import type { Session } from '@supabase/auth-js'
import type { AuthState } from '@/contexts/auth'
import type { AppUser } from '@/types/auth'
import { hasAccount, isDemoSession } from './session'

const signedIn = (user: Partial<AppUser>): AuthState => ({
  status: 'authenticated',
  user: { id: 'u1', ...user } as AppUser,
  session: {} as Session,
})

describe('session kinds', () => {
  it.each([
    ['still loading', { status: 'loading' } as AuthState, false, false],
    ['signed out', { status: 'unauthenticated' } as AuthState, false, false],
    ['a demo visitor', signedIn({ isDemo: true }), false, true],
    ['a real account', signedIn({ isDemo: false }), true, false],
  ])('%s', (_label, state, account, demo) => {
    expect(hasAccount(state)).toBe(account)
    expect(isDemoSession(state)).toBe(demo)
  })
})
