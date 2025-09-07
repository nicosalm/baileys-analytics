import { z } from 'zod'
import { uuidSchema, currencyAmountSchema, positiveNumberSchema } from './common'

// property schemas
export const propertySchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  property_id: z.string(), // ownerrez property id
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  bedrooms: z.number().int().min(0).nullable(),
  bathrooms: z.number().min(0).nullable(),
  max_guests: z.number().int().positive().nullable(),
  property_type: z.string().nullable(),
  listing_url: z.string().url().nullable(),
  thumbnail_url: z.string().url().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export const createPropertySchema = propertySchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const updatePropertySchema = propertySchema.partial().omit({
  id: true,
  tenant_id: true,
  property_id: true,
  created_at: true,
  updated_at: true
})

export const propertyMetricsSchema = z.object({
  propertyId: z.string(),
  propertyName: z.string(),
  revenue: currencyAmountSchema,
  bookings: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(1),
  avgNightlyRate: currencyAmountSchema,
  totalNights: positiveNumberSchema
})

// types
export type Property = z.infer<typeof propertySchema>
export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
export type PropertyMetrics = z.infer<typeof propertyMetricsSchema>