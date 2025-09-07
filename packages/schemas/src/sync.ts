import { z } from 'zod'
import { dateStringSchema, uuidSchema } from './common'

// sync request schemas
export const syncPropertiesSchema = z.object({
  force: z.boolean().optional().default(false)
})

export const syncBookingsSchema = z.object({
  propertyId: z.string().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  syncType: z.enum(['recent', 'historical', 'guest-details']).optional().default('recent')
})

export const manualSyncSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  startDate: dateStringSchema,
  endDate: dateStringSchema
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Start date must be before or equal to end date'
})

export const syncStatusSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  sync_type: z.enum(['properties', 'bookings', 'full']),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  error_message: z.string().nullable(),
  metadata: z.object({
    properties_synced: z.number().optional(),
    bookings_synced: z.number().optional(),
    errors: z.array(z.string()).optional()
  }).optional()
})

// webhook schemas
export const ownerrezWebhookSchema = z.object({
  event_type: z.string(),
  event_id: z.string(),
  timestamp: z.string(),
  data: z.record(z.any())
})

// types
export type SyncPropertiesInput = z.infer<typeof syncPropertiesSchema>
export type SyncBookingsInput = z.infer<typeof syncBookingsSchema>
export type ManualSyncInput = z.infer<typeof manualSyncSchema>
export type SyncStatus = z.infer<typeof syncStatusSchema>
export type OwnerRezWebhook = z.infer<typeof ownerrezWebhookSchema>