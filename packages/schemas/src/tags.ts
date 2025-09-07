import { z } from 'zod'
import { uuidSchema } from './common'

// tag schemas
export const tagSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  description: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  description: z.string().max(200).optional()
})

export const updateTagSchema = createTagSchema.partial()

export const bulkAssignTagsSchema = z.object({
  tagIds: z.array(uuidSchema),
  bookingIds: z.array(uuidSchema).optional(),
  propertyIds: z.array(uuidSchema).optional(),
  guestIds: z.array(uuidSchema).optional(),
  action: z.enum(['add', 'remove', 'replace']).default('add')
})

export const tagFilterSchema = z.object({
  includeInactive: z.boolean().optional(),
  search: z.string().optional()
})

// types
export type Tag = z.infer<typeof tagSchema>
export type CreateTag = z.infer<typeof createTagSchema>
export type UpdateTag = z.infer<typeof updateTagSchema>
export type BulkAssignTags = z.infer<typeof bulkAssignTagsSchema>
export type TagFilter = z.infer<typeof tagFilterSchema>