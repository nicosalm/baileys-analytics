import { z } from 'zod'
import { uuidSchema, dateStringSchema, currencyAmountSchema, emailSchema } from './common'

// booking charge schema
export const bookingChargeSchema = z.object({
  id: uuidSchema,
  booking_id: uuidSchema,
  type: z.enum(['tax', 'fee', 'discount', 'other']),
  description: z.string(),
  amount: currencyAmountSchema,
  is_percentage: z.boolean().default(false),
  percentage_value: z.number().nullable()
})

// booking schema
export const bookingSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  property_id: uuidSchema,
  ownerrez_booking_id: z.string().nullable(),
  ownerrez_property_id: z.string().nullable(),
  confirmation_code: z.string().nullable(),
  arrival: dateStringSchema,
  departure: dateStringSchema,
  nights: z.number().int().positive(),
  adults: z.number().int().min(0).default(0),
  children: z.number().int().min(0).default(0),
  pets: z.number().int().min(0).default(0),
  total_amount: currencyAmountSchema,
  rent_amount: currencyAmountSchema.nullable(),
  fees_amount: currencyAmountSchema.nullable(),
  taxes_amount: currencyAmountSchema.nullable(),
  guest_name: z.string().nullable(),
  guest_email: emailSchema.nullable(),
  guest_phone: z.string().nullable(),
  guest_address: z.string().nullable(),
  guest_city: z.string().nullable(),
  guest_state: z.string().nullable(),
  guest_country: z.string().nullable(),
  status: z.enum(['booked', 'canceled', 'pending', 'checked_in', 'checked_out']).default('booked'),
  source: z.string().nullable(),
  listing_site: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  booking_charges: z.array(bookingChargeSchema).optional()
})

export const createBookingSchema = bookingSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const updateBookingSchema = bookingSchema.partial().omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true
})

export const bookingFilterSchema = z.object({
  property_id: uuidSchema.optional(),
  from_date: dateStringSchema.optional(),
  to_date: dateStringSchema.optional(),
  status: bookingSchema.shape.status.optional(),
  source: z.string().optional(),
  guest_name: z.string().optional()
})

// types
export type BookingCharge = z.infer<typeof bookingChargeSchema>
export type Booking = z.infer<typeof bookingSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>
export type BookingFilter = z.infer<typeof bookingFilterSchema>