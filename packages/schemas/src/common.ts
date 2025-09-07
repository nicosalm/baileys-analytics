import { z } from 'zod'

// common schemas used across the application
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const uuidSchema = z.string().uuid()

export const emailSchema = z.string().email()

export const positiveNumberSchema = z.number().positive()

export const percentageSchema = z.number().min(0).max(100)

export const currencyAmountSchema = z.number().min(0).finite()

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
})

export const dateRangeSchema = z.object({
  from: dateStringSchema,
  to: dateStringSchema
}).refine((data) => new Date(data.from) <= new Date(data.to), {
  message: 'Start date must be before or equal to end date'
})