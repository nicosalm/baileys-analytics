import { z } from 'zod'

export const platformFeeEntrySchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  bookingId: z.string().uuid().optional().nullable(),
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  guestServiceFee: z.number().min(0).default(0),
  hostServiceFee: z.number().min(0).default(0),
  platformRemitsTax: z.boolean().default(false),
  platformTaxRemitted: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().uuid().optional()
})

export type PlatformFeeEntry = z.infer<typeof platformFeeEntrySchema>

export const platformFeeFormSchema = platformFeeEntrySchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true
})

export type PlatformFeeForm = z.infer<typeof platformFeeFormSchema>

export const jurisdictionSchema = z.object({
  name: z.string().min(1, 'Jurisdiction name is required'),
  rate: z.number().min(0).max(1, 'Rate must be between 0 and 1'),
  type: z.enum(['state', 'county', 'city', 'district', 'other']),
  appliesTo: z.enum(['all', 'rental', 'platform_fees', 'specific_items']).default('all')
})

export type Jurisdiction = z.infer<typeof jurisdictionSchema>

export const platformTaxSettingSchema = z.object({
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  collectsTax: z.boolean().default(false),
  remitsTax: z.boolean().default(false),
  taxRate: z.number().min(0).max(1).optional(),
  feeStructure: z.object({
    hostFeePercentage: z.number().min(0).max(1),
    guestFeePercentage: z.number().min(0).max(1),
    flatFee: z.number().min(0).optional()
  }).optional()
})

export type PlatformTaxSetting = z.infer<typeof platformTaxSettingSchema>

export const propertyTaxConfigurationSchema = z.object({
  id: z.string().uuid().optional(),
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  configName: z.string().min(1, 'Configuration name is required'),
  jurisdictions: z.array(jurisdictionSchema).min(1, 'At least one jurisdiction is required'),
  taxableItems: z.array(z.enum([
    'base_rent',
    'cleaning_fee',
    'service_fee',
    'platform_fee',
    'credit_card_fee',
    'damage_waiver',
    'pet_fee',
    'extra_guest_fee',
    'early_checkin_fee',
    'late_checkout_fee',
    'other_fees'
  ])).default(['base_rent']),
  platformSettings: z.array(platformTaxSettingSchema),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})

export type PropertyTaxConfig = z.infer<typeof propertyTaxConfigurationSchema>

export const taxRemittanceSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid().optional().nullable(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalRevenue: z.number().min(0),
  totalPlatformFees: z.number().min(0).default(0),
  totalTaxDue: z.number().min(0),
  platformRemitted: z.number().min(0).default(0),
  ownerRemitted: z.number().min(0),
  filingStatus: z.enum(['pending', 'filed', 'paid', 'overdue']).default('pending'),
  filedDate: z.string().datetime().optional().nullable(),
  confirmationNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})

export type TaxRemittance = z.infer<typeof taxRemittanceSchema>

export const taxCalculationRequestSchema = z.object({
  propertyId: z.string().uuid(),
  bookingAmount: z.number().min(0),
  platformFees: z.object({
    guestServiceFee: z.number().min(0).default(0),
    hostServiceFee: z.number().min(0).default(0)
  }).optional(),
  bookingDate: z.string().datetime(),
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  includeBreakdown: z.boolean().default(true)
})

export type TaxCalculationRequest = z.infer<typeof taxCalculationRequestSchema>

export const taxCalculationResponseSchema = z.object({
  totalRevenue: z.number(),
  totalTaxDue: z.number(),
  platformRemitted: z.number(),
  ownerRemitted: z.number(),
  effectiveRate: z.number(),
  breakdown: z.array(z.object({
    jurisdiction: z.string(),
    rate: z.number(),
    amount: z.number(),
    paidBy: z.enum(['owner', 'platform'])
  })).optional()
})

export type TaxCalculationResponse = z.infer<typeof taxCalculationResponseSchema>

export const bulkPlatformFeeImportSchema = z.object({
  propertyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  entries: z.array(z.object({
    platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
    bookingReference: z.string().optional(),
    guestServiceFee: z.number().min(0),
    hostServiceFee: z.number().min(0),
    platformRemitsTax: z.boolean(),
    platformTaxRemitted: z.number().min(0)
  }))
})

export type BulkPlatformFeeImport = z.infer<typeof bulkPlatformFeeImportSchema>

export const propertyTaxStatusSchema = z.object({
  propertyId: z.string().uuid(),
  propertyName: z.string(),
  hasConfig: z.boolean(),
  hasPlatformFees: z.boolean(),
  missingMonths: z.array(z.string()),
  lastUpdated: z.string().datetime().optional()
})

export type PropertyTaxStatus = z.infer<typeof propertyTaxStatusSchema>