import { z } from 'zod'

export const taxJurisdictionSchema = z.object({
  name: z.string().min(1, 'Jurisdiction name is required'),
  rate: z.number().min(0).max(100),
  description: z.string().optional(),
  ownerrezPattern: z.string().optional()
})

export const platformSettingsSchema = z.record(
  z.string(),
  z.object({
    remitsTax: z.boolean(),
    remittedRate: z.number().optional()
  })
)

export const taxConfigSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  propertyName: z.string().min(1, 'Property name is required'),
  propertyAddress: z.string().optional(),
  configName: z.string().min(1, 'Configuration name is required'),
  jurisdictions: z.array(taxJurisdictionSchema).min(1, 'At least one jurisdiction is required'),
  platformSettings: platformSettingsSchema,
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  ownerrezMappings: z.array(z.object({
    pattern: z.string(),
    originalDescriptions: z.array(z.string()),
    jurisdictionIndex: z.number(),
    detectedRate: z.number(),
    occurrenceCount: z.number()
  })).optional(),
  autoDetected: z.boolean().optional()
})

export const platformFeeSchema = z.object({
  propertyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format'),
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  guestServiceFee: z.number().min(0).default(0),
  hostServiceFee: z.number().min(0).default(0),
  platformRemitsTax: z.boolean().default(false),
  platformTaxRemitted: z.number().min(0).default(0),
  bookingId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
})

export type TaxJurisdiction = z.infer<typeof taxJurisdictionSchema>
export type PlatformSettings = z.infer<typeof platformSettingsSchema>
export type TaxConfig = z.infer<typeof taxConfigSchema>
export type PlatformFee = z.infer<typeof platformFeeSchema>