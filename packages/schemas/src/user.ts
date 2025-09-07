import { z } from 'zod'
import { uuidSchema, emailSchema } from './common'

export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_metadata: z.record(z.string(), z.any()).optional(),
  app_metadata: z.record(z.string(), z.any()).optional()
})

export const tenantSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  company_name: z.string().nullable(),
  ownerrez_username: z.string().nullable(),
  ownerrez_token: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  settings: z.record(z.string(), z.any()).optional()
})

export const updateTenantSchema = z.object({
  company_name: z.string().min(1).optional(),
  ownerrez_username: z.string().min(1).optional(),
  ownerrez_token: z.string().min(1).optional(),
  settings: z.record(z.string(), z.any()).optional()
})

export type User = z.infer<typeof userSchema>
export type Tenant = z.infer<typeof tenantSchema>
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>