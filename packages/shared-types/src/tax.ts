import { z } from 'zod'

// Tax jurisdiction types
export const jurisdictionTypeSchema = z.enum(['state', 'county', 'city', 'special', 'other'])
export type JurisdictionType = z.infer<typeof jurisdictionTypeSchema>

// Detected jurisdiction from OwnerRez data
export const detectedJurisdictionItemSchema = z.object({
  originalDescription: z.string(),
  basePattern: z.string(),
  jurisdictionType: jurisdictionTypeSchema,
  occurrenceCount: z.number(),
  totalAmount: z.number(),
  averageRate: z.number(),
  suggestedName: z.string()
})

export const detectedJurisdictionSchema = z.object({
  propertyId: z.string().uuid(),
  propertyName: z.string(),
  jurisdictions: z.array(detectedJurisdictionItemSchema)
})

// Tax jurisdictions API response
export const taxJurisdictionsResponseSchema = z.object({
  properties: z.array(detectedJurisdictionSchema),
  summary: z.object({
    totalProperties: z.number(),
    averageJurisdictionsPerProperty: z.number()
  })
})

// OwnerRez mapping for property tax config
export const ownerrezMappingSchema = z.object({
  pattern: z.string(),
  originalDescriptions: z.array(z.string()),
  jurisdictionIndex: z.number(),
  detectedRate: z.number(),
  occurrenceCount: z.number()
})

// Property tax config with OwnerRez mappings
export const propertyTaxConfigSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  configName: z.string(),
  jurisdictions: z.array(z.object({
    name: z.string(),
    type: jurisdictionTypeSchema,
    rate: z.number(),
    isActive: z.boolean()
  })),
  taxableItems: z.object({
    rent: z.boolean(),
    cleaningFees: z.boolean(),
    petFees: z.boolean(),
    otherFees: z.boolean()
  }),
  platformSettings: z.object({
    airbnbRemitsTax: z.boolean(),
    vrboRemitsTax: z.boolean(),
    bookingComRemitsTax: z.boolean()
  }),
  ownerrezMappings: z.array(ownerrezMappingSchema).optional(),
  autoDetected: z.boolean().optional(),
  lastSyncDate: z.string().datetime().optional(),
  isActive: z.boolean(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// Export types
export type DetectedJurisdictionItem = z.infer<typeof detectedJurisdictionItemSchema>
export type DetectedJurisdiction = z.infer<typeof detectedJurisdictionSchema>
export type TaxJurisdictionsResponse = z.infer<typeof taxJurisdictionsResponseSchema>
export type OwnerrezMapping = z.infer<typeof ownerrezMappingSchema>
export type PropertyTaxConfig = z.infer<typeof propertyTaxConfigSchema>