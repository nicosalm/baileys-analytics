import type { AppUser } from '@/types/auth'

// connect OwnerRez first so the plan can be priced from the real property count, then pay,
// then the dashboard runs the full import. 'unknown' means /auth/me didn't answer.
export type OnboardingStep = 'unknown' | 'connect' | 'plan' | 'ready'

export const getOnboardingStep = (user: Pick<AppUser, 'isDemo' | 'hasOwnerRezConnection' | 'hasActivePlan'>): OnboardingStep => {
  if (user.isDemo) return 'ready'
  // a missing profile also reads as "not connected", so check it before trusting the connection flag
  if (user.hasActivePlan === undefined) return 'unknown'
  if (!user.hasOwnerRezConnection) return 'connect'
  return user.hasActivePlan ? 'ready' : 'plan'
}
