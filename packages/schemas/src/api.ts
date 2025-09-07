import { z } from 'zod';
import { uuidSchema, dateStringSchema } from './common';

export const paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export const dateRangeQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional()
});

export const idParamSchema = z.object({
  id: uuidSchema
});

export const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional()
});

export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.array(z.object({
    path: z.string(),
    message: z.string()
  })).optional(),
  code: z.string().optional()
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  hasMore: z.boolean()
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;