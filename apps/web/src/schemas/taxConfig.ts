import { z } from 'zod'

export const platformFeeSchema = z.object({
  propertyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format'),
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  guestServiceFee: z.number().min(0).default(0),
  hostServiceFee: z.number().min(0).default(0),
  platformRemitsTax: z.boolean().default(false),
  platformTaxRemitted: z.number().min(0).default(0),
  bookingId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
})

export type PlatformFee = z.infer<typeof platformFeeSchema>