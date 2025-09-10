import { User as SupabaseUser } from '@supabase/supabase-js'

export interface AppUser extends SupabaseUser {
  companyName?: string
  hasOwnerRezConnection?: boolean
  tenantId?: string
}

export interface AuthSession {
  user: AppUser
  access_token: string
  refresh_token?: string
}