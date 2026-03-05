import { User as SupabaseUser } from '@supabase/supabase-js'

export interface AppUser extends SupabaseUser {
  hasOwnerRezConnection?: boolean
  tenantId?: string
  isOAuthUser?: boolean
  companyName?: string | null
  isDemo?: boolean
}

export interface AuthSession {
  user: AppUser
  access_token: string
  refresh_token?: string
}