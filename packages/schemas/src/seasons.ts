import { z } from 'zod'
import { uuidSchema, dateStringSchema, percentageSchema } from './common'

// season configuration schemas
export const seasonPeriodSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  name: z.string().optional()
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Start date must be before or equal to end date'
})

export const seasonConfigSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string().min(1, 'Season name is required').max(100),
  description: z.string().max(500).optional(),
  periods: z.array(seasonPeriodSchema).min(1, 'At least one period is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  priceMultiplier: z.number().min(0.1).max(10).default(1),
  minimumStay: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const createSeasonSchema = seasonConfigSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
})

export const updateSeasonSchema = createSeasonSchema.partial()

export const seasonAnalyticsRequestSchema = z.object({
  seasonId: uuidSchema,
  fromDate: dateStringSchema.optional(),
  toDate: dateStringSchema.optional(),
  compareWithPrevious: z.boolean().default(false)
})

// types
export type SeasonPeriod = z.infer<typeof seasonPeriodSchema>
export type SeasonConfig = z.infer<typeof seasonConfigSchema>
export type CreateSeason = z.infer<typeof createSeasonSchema>
export type UpdateSeason = z.infer<typeof updateSeasonSchema>
export type SeasonAnalyticsRequest = z.infer<typeof seasonAnalyticsRequestSchema>