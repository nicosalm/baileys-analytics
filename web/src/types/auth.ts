import type { User as SupabaseUser } from '@supabase/auth-js'

export interface AppUser extends SupabaseUser {
  hasOwnerRezConnection?: boolean
  tenantId?: string
  isOAuthUser?: boolean
  companyName?: string | null
  isDemo?: boolean
  // undefined when /auth/me didn't answer; the subscription gate then asks billing itself
  hasActivePlan?: boolean
}

export interface MeResponse {
  id: string
  email?: string
  tenantId: string | null
  companyName: string | null
  hasOwnerRezConnection: boolean
  hasActivePlan: boolean
  createdAt: string
}
