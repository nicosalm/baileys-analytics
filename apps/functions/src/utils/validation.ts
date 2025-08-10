import { z } from 'zod'

// ============= Date/Time Utilities with Zod =============

// Parse various date formats
export const flexibleDateSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.date(),
  z.number(), // Unix timestamp
]).transform((val) => {
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val)
  return new Date(val)
})

// Ensure valid date range
export const dateRangeValidationSchema = z.object({
  from: flexibleDateSchema,
  to: flexibleDateSchema,
}).refine(data => data.from <= data.to, {
  message: "From date must be before or equal to To date"
})

// Parse year and month
export const yearMonthSchema = z.object({
  year: z.union([
    z.string().regex(/^\d{4}$/).transform(v => parseInt(v, 10)),
    z.number().int().min(2000).max(2100),
  ]),
  month: z.union([
    z.string().regex(/^\d{1,2}$/).transform(v => parseInt(v, 10)),
    z.number().int().min(1).max(12),
  ]),
})

// ============= Array Processing Schemas =============

// Safe array processing with validation
export const safeArraySchema = <T extends z.ZodType>(itemSchema: T) =>
  z.array(itemSchema).catch([]) // Returns empty array on error

// Filter and transform array
export const filterMapSchema = <T extends z.ZodType>(
  itemSchema: T,
  filterFn?: (item: z.infer<T>) => boolean
) => z.array(itemSchema).transform(items => 
  filterFn ? items.filter(filterFn) : items
)

// ============= Number Parsing with Validation =============

export const safeNumberSchema = z.union([
  z.number(),
  z.string().regex(/^-?\d+\.?\d*$/).transform(v => parseFloat(v)),
  z.null().transform(() => 0),
  z.undefined().transform(() => 0),
])

export const safeIntegerSchema = z.union([
  z.number().int(),
  z.string().regex(/^-?\d+$/).transform(v => parseInt(v, 10)),
  z.null().transform(() => 0),
  z.undefined().transform(() => 0),
])

export const percentageSchema = z.number().min(0).max(100)

export const currencySchema = z.number().min(0).transform(val => 
  Math.round(val * 100) / 100 // Round to 2 decimal places
)

// ============= String Processing Schemas =============

export const trimmedStringSchema = z.string().transform(s => s.trim())

export const nonEmptyStringSchema = z.string().transform(s => s.trim()).refine(s => s.length > 0, {
  message: "Cannot be empty"
})

export const csvStringToArraySchema = z.string().transform(val => 
  val.split(',').map(s => s.trim()).filter(Boolean)
)

export const slugSchema = z.string().regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "Must be a valid slug (lowercase letters, numbers, and hyphens only)"
)

// ============= Email and URL Schemas =============

export const emailListSchema = z.string().transform(val => {
  const emails = val.split(/[,;]/).map(e => e.trim()).filter(Boolean)
  return z.array(z.string().email()).parse(emails)
})

export const urlWithProtocolSchema = z.string().transform(val => {
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    return `https://${val}`
  }
  return val
}).pipe(z.string().url())

// ============= JSON Parsing Schemas =============

export const safeJsonParseSchema = <T extends z.ZodType>(schema: T) =>
  z.union([
    z.string().transform(val => {
      try {
        return JSON.parse(val)
      } catch {
        throw new z.ZodError([{
          code: z.ZodIssueCode.custom,
          message: "Invalid JSON string",
          path: [],
        }])
      }
    }).pipe(schema),
    schema, // Already parsed
  ])

// ============= Pagination Schemas =============

export const paginationRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      totalItems: z.number(),
      totalPages: z.number(),
      hasMore: z.boolean(),
    }),
  })

// ============= Error Handling Schemas =============

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
  details: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
})

export const resultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ])

// ============= Helper Functions =============

/**
 * Parse with fallback value
 */
export function parseWithFallback<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T
): T {
  const result = schema.safeParse(value)
  return result.success ? result.data : fallback
}

/**
 * Parse and log errors
 */
export function parseWithLogging<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(value)
  if (!result.success) {
    console.error(`Validation error${context ? ` in ${context}` : ''}:`, result.error.errors)
    return null
  }
  return result.data
}

/**
 * Batch validate array of items
 */
export function batchValidate<T>(
  schema: z.ZodType<T>,
  items: unknown[]
): { valid: T[], invalid: Array<{ item: unknown, errors: z.ZodError }> } {
  const valid: T[] = []
  const invalid: Array<{ item: unknown, errors: z.ZodError }> = []
  
  for (const item of items) {
    const result = schema.safeParse(item)
    if (result.success) {
      valid.push(result.data)
    } else {
      invalid.push({ item, errors: result.error })
    }
  }
  
  return { valid, invalid }
}