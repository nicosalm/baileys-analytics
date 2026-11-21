import { User as SupabaseUser } from '@supabase/supabase-js'

export interface AppUser extends SupabaseUser {
  hasOwnerRezConnection?: boolean
  tenantId?: string
  isOAuthUser?: boolean
  companyName?: string | null
  isDemo?: boolean
}


export interface MeResponse {
  id: string
  email?: string
  tenantId: string | null
  companyName: string | null
  hasOwnerRezConnection: boolean
  createdAt: string
}
