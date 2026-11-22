import { describe, it, expect } from 'vitest'
import { getOnboardingStep } from './onboarding'

describe('getOnboardingStep', () => {
  it.each([
    ['a demo visitor', 'ready', { isDemo: true, hasOwnerRezConnection: true, hasActivePlan: undefined }],
    ['a new account', 'connect', { isDemo: false, hasOwnerRezConnection: false, hasActivePlan: false }],
    ['a connected account that has not paid', 'plan', { isDemo: false, hasOwnerRezConnection: true, hasActivePlan: false }],
    ['a paying account', 'ready', { isDemo: false, hasOwnerRezConnection: true, hasActivePlan: true }],
    // paid under the old flow, before connecting
    ['a paying account that never connected', 'connect', { isDemo: false, hasOwnerRezConnection: false, hasActivePlan: true }],
    // /auth/me timed out, so the connection flag defaulted to false
    ['an account whose profile did not load', 'unknown', { isDemo: false, hasOwnerRezConnection: false, hasActivePlan: undefined }],
  ] as const)('sends %s to %s', (_label, step, user) => {
    expect(getOnboardingStep(user)).toBe(step)
  })
})
