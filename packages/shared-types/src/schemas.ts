import { z } from 'zod'

// ============= Common Schemas =============
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().optional(),
})

export const dateRangeSchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
})

// Common query parameter schemas
export const tagsQuerySchema = z.object({
  tags: z.string().optional().transform(val => val?.split(',').filter(Boolean) || []),
})

export const dateRangeWithTagsSchema = dateRangeSchema.merge(tagsQuerySchema)

export const financialQuerySchema = dateRangeWithTagsSchema

export const guestsQuerySchema = dateRangeWithTagsSchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
})

export const propertyQuerySchema = z.object({
  propertyId: z.string(),
}).merge(dateRangeWithTagsSchema)

// ============= Auth Schemas =============
export const authTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

export const authInfoSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  tenantId: z.string().optional(),
})

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const signupRequestSchema = loginRequestSchema.extend({
  companyName: z.string().optional(),
})

// ============= Property Schemas =============
export const propertySchema = z.object({
  id: z.string(),
  ownerrezId: z.string(),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  maxGuests: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  publicUrl: z.string().url().optional(),
  active: z.boolean(),
  tags: z.array(z.string()).optional(),
})

// ============= Booking Schemas =============
export const bookingStatusSchema = z.enum(['confirmed', 'canceled', 'blocked', 'pending'])

export const bookingChargeSchema = z.object({
  type: z.string(),
  description: z.string(),
  amount: z.number(),
  isTaxable: z.boolean(),
  position: z.number(),
})

export const bookingSchema = z.object({
  id: z.string(),
  ownerrezBookingId: z.string(),
  propertyId: z.string(),
  arrival: dateStringSchema,
  departure: dateStringSchema,
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
  guestName: z.string(),
  guestEmail: z.string().email().optional(),
  totalAmount: z.number(),
  status: bookingStatusSchema,
  listingSite: z.string().optional(),
  platformReservationNumber: z.string().optional(),
  bookedUtc: z.string().datetime(),
  canceledUtc: z.string().datetime().optional(),
  charges: z.array(bookingChargeSchema).optional(),
  tags: z.array(z.string()).optional(),
})

// ============= Sync Schemas =============
export const syncRequestSchema = z.object({
  full: z.boolean().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
})

export const syncStatusSchema = z.object({
  status: z.enum(['idle', 'syncing', 'completed', 'error']),
  lastSync: z.string().datetime().optional(),
  bookingsSynced: z.number().optional(),
  propertiesSynced: z.number().optional(),
  error: z.string().optional(),
})

// ============= Tax Schemas =============
export const taxRuleTypeSchema = z.enum(['percentage', 'flatFee', 'perNight', 'perGuest'])

export const taxRuleMethodSchema = z.object({
  type: taxRuleTypeSchema,
  value: z.number(),
  taxableCategories: z.array(z.string()).optional(),
})

export const taxRuleAppliesToSchema = z.object({
  properties: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  dateRange: z.object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  }).optional(),
})

export const taxRuleFormDataSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  method: taxRuleMethodSchema,
  appliesTo: taxRuleAppliesToSchema,
  jurisdiction: z.string().optional(),
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional(),
  priority: z.number().int().min(0),
  isActive: z.boolean(),
})

export const taxRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: taxRuleTypeSchema,
  value: z.number(),
  appliesTo: z.object({
    properties: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  }).optional(),
  conditions: z.object({
    minNights: z.number().optional(),
    maxNights: z.number().optional(),
    minAmount: z.number().optional(),
    includeChannels: z.array(z.string()).optional(),
    excludeChannels: z.array(z.string()).optional(),
  }).optional(),
  active: z.boolean(),
  priority: z.number(),
})

export const taxCalculationRequestSchema = z.object({
  propertyId: z.string(),
  arrival: dateStringSchema,
  departure: dateStringSchema,
  subtotal: z.number(),
  guests: z.number().optional(),
  channel: z.string().optional(),
})

// ============= Report Schemas =============
export const reportTypeSchema = z.enum(['financial', 'tax', 'occupancy', 'guest'])
export const reportFormatSchema = z.enum(['pdf', 'csv', 'xlsx'])
export const reportFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])

export const reportConfigSchema = z.object({
  type: reportTypeSchema,
  format: reportFormatSchema,
  frequency: reportFrequencySchema.optional(),
  filters: z.object({
    propertyIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: dateRangeSchema.optional(),
  }).optional(),
  delivery: z.object({
    email: z.string().email().optional(),
    webhook: z.string().url().optional(),
  }).optional(),
})

export const reportScheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: reportFrequencySchema,
  dayOfWeek: z.number().min(0).max(6).optional(), // 0 = Sunday
  dayOfMonth: z.number().min(1).max(31).optional(),
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59).default(0),
  timezone: z.string().default('America/Chicago'),
})

export const reportRequestSchema = z.object({
  type: reportTypeSchema,
  from: dateStringSchema,
  to: dateStringSchema,
  propertyIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  format: reportFormatSchema.optional(),
})

export const scheduledReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: reportConfigSchema,
  schedule: reportScheduleSchema,
  lastRun: z.string().datetime().optional(),
  nextRun: z.string().datetime().optional(),
  status: z.enum(['active', 'paused', 'error']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// ============= VIP Settings Schemas =============
export const vipSettingsUpdateSchema = z.object({
  vipSpendThreshold: z.number().min(0).optional(),
  vipBookingThreshold: z.number().int().min(1).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

export const vipSettingsSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  vipGuests: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    tags: z.array(z.string()).optional(),
  })),
  vipProperties: z.array(z.string()),
  thresholds: z.object({
    bookingCount: z.number().optional(),
    totalRevenue: z.number().optional(),
    avgBookingValue: z.number().optional(),
  }),
  updatedAt: z.string().datetime(),
})

// ============= Database Result Schemas =============
// Schema for parsing numeric strings from database
export const numericStringSchema = z.string().transform(val => parseFloat(val))
export const integerStringSchema = z.string().transform(val => parseInt(val, 10))

// Common database result schemas
export const dbMetricsSchema = z.object({
  gross_revenue: numericStringSchema,
  total_fees: numericStringSchema,
  total_taxes: numericStringSchema,
  net_revenue: numericStringSchema.optional(),
  booking_count: integerStringSchema,
  pending_revenue: numericStringSchema.optional(),
  collected_revenue: numericStringSchema.optional(),
})

export const dbPropertyMetricsSchema = z.object({
  property_id: z.string(),
  property_name: z.string(),
  total_amount: numericStringSchema,
  booking_count: integerStringSchema,
  occupancy_rate: numericStringSchema.optional(),
})

export const dbGuestMetricsSchema = z.object({
  guest_name: z.string(),
  guest_email: z.string().nullable(),
  total_spent: numericStringSchema,
  booking_count: integerStringSchema,
  avg_nightly_rate: numericStringSchema.optional(),
})

// ============= Error Response Schema =============
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
})

// ============= Type Exports =============
export type DateRange = z.infer<typeof dateRangeSchema>
export type Pagination = z.infer<typeof paginationSchema>
export type AuthToken = z.infer<typeof authTokenSchema>
export type AuthInfo = z.infer<typeof authInfoSchema>
export type Property = z.infer<typeof propertySchema>
export type Booking = z.infer<typeof bookingSchema>
export type BookingCharge = z.infer<typeof bookingChargeSchema>
export type SyncRequest = z.infer<typeof syncRequestSchema>
export type SyncStatus = z.infer<typeof syncStatusSchema>
export type TaxRule = z.infer<typeof taxRuleSchema>
export type TaxCalculationRequest = z.infer<typeof taxCalculationRequestSchema>
export type ReportRequest = z.infer<typeof reportRequestSchema>
export type VipSettings = z.infer<typeof vipSettingsSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>