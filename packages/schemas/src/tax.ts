import { z } from 'zod'
import { uuidSchema, dateStringSchema, currencyAmountSchema, percentageSchema } from './common'

// tax configuration schemas
export const propertyTaxJurisdictionSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1, 'Jurisdiction name is required'),
  type: z.enum(['state', 'county', 'city', 'district', 'other']),
  rate: z.number().min(0).max(100), // percentage
  appliesTo: z.enum(['all', 'rental', 'platform_fees', 'specific_items']).default('all'),
  isActive: z.boolean().default(true)
})

export const propertyTaxConfigSchema = z.object({
  id: uuidSchema.optional(),
  tenantId: uuidSchema,
  propertyId: uuidSchema,
  jurisdictions: z.array(propertyTaxJurisdictionSchema),
  collectTaxes: z.boolean().default(true),
  taxIncludedInRates: z.boolean().default(false),
  notes: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})

export const createPropertyTaxConfigSchema = propertyTaxConfigSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
})

export const updatePropertyTaxConfigSchema = createPropertyTaxConfigSchema.partial()

export const calculateTaxRequestSchema = z.object({
  propertyId: uuidSchema,
  amount: currencyAmountSchema,
  arrivalDate: dateStringSchema,
  departureDate: dateStringSchema,
  platform: z.string().optional()
})

export const taxReportRequestSchema = z.object({
  fromDate: dateStringSchema,
  toDate: dateStringSchema,
  propertyId: uuidSchema.optional(),
  groupBy: z.enum(['property', 'jurisdiction', 'month']).default('property')
})

export const bulkTaxUpdateSchema = z.object({
  bookingIds: z.array(uuidSchema),
  recalculate: z.boolean().default(true)
})

// types
export type PropertyTaxJurisdiction = z.infer<typeof propertyTaxJurisdictionSchema>
export type PropertyTaxConfiguration = z.infer<typeof propertyTaxConfigSchema>
export type CreatePropertyTaxConfig = z.infer<typeof createPropertyTaxConfigSchema>
export type UpdatePropertyTaxConfig = z.infer<typeof updatePropertyTaxConfigSchema>
export type CalculateTaxRequest = z.infer<typeof calculateTaxRequestSchema>
export type TaxReportRequest = z.infer<typeof taxReportRequestSchema>
export type BulkTaxUpdate = z.infer<typeof bulkTaxUpdateSchema>