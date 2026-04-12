import { z } from 'zod'
import { uuidSchema } from './common'

export const createPropertyGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50),
  description: z.string().max(200).optional(),
  propertyIds: z.array(uuidSchema).default([])
})

export const updatePropertyGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50).optional(),
  description: z.string().max(200).optional(),
  propertyIds: z.array(uuidSchema).optional()
})

export type CreatePropertyGroup = z.infer<typeof createPropertyGroupSchema>
export type UpdatePropertyGroup = z.infer<typeof updatePropertyGroupSchema>
