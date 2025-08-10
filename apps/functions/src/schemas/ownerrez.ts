import { z } from 'zod'

// OwnerRez Property Response
export const ownerRezPropertySchema = z.object({
  id: z.number(),
  name: z.string(),
  internal_name: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  max_guests: z.number().optional(),
  property_type: z.string().optional(),
  active: z.boolean(),
  photos: z.array(z.object({
    url: z.string().url(),
    is_primary: z.boolean(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.any()).optional(),
})

// OwnerRez Booking Response
export const ownerRezBookingSchema = z.object({
  id: z.number(),
  property_id: z.number(),
  arrival: z.string(),
  departure: z.string(),
  status: z.enum(['booked', 'canceled', 'blocked', 'inquiry']),
  total_amount: z.number(),
  guest: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
  listing_site: z.string().optional(),
  platform_reservation_number: z.string().optional(),
  booked_date: z.string(),
  canceled_date: z.string().optional(),
  charges: z.array(z.object({
    type: z.string(),
    description: z.string(),
    amount: z.number(),
    is_taxable: z.boolean(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.any()).optional(),
})

// OwnerRez Tag Definition Response
export const ownerRezTagDefinitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean(),
  created_date: z.string(),
  modified_date: z.string().optional(),
})

// API List Response wrapper
export const ownerRezListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total_count: z.number(),
    has_more: z.boolean(),
    next_page_url: z.string().url().optional(),
  })

// Specific list responses
export const ownerRezPropertiesResponseSchema = ownerRezListResponseSchema(ownerRezPropertySchema)
export const ownerRezBookingsResponseSchema = ownerRezListResponseSchema(ownerRezBookingSchema)
export const ownerRezTagsResponseSchema = ownerRezListResponseSchema(ownerRezTagDefinitionSchema)

// Transform OwnerRez data to our database format
export const transformOwnerRezProperty = (property: z.infer<typeof ownerRezPropertySchema>) => ({
  ownerrezId: property.id.toString(),
  name: property.name,
  internalName: property.internal_name,
  address: property.address?.street,
  city: property.address?.city,
  state: property.address?.state,
  postalCode: property.address?.postal_code,
  latitude: property.coordinates?.latitude,
  longitude: property.coordinates?.longitude,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms,
  maxGuests: property.max_guests,
  propertyType: property.property_type,
  active: property.active,
  thumbnailUrl: property.photos?.find(p => p.is_primary)?.url,
  tags: property.tags || [],
})

export const transformOwnerRezBooking = (booking: z.infer<typeof ownerRezBookingSchema>) => ({
  ownerrezBookingId: booking.id.toString(),
  propertyId: booking.property_id.toString(),
  arrival: booking.arrival,
  departure: booking.departure,
  status: booking.status,
  totalAmount: booking.total_amount,
  guestName: `${booking.guest.first_name} ${booking.guest.last_name}`.trim(),
  guestEmail: booking.guest.email,
  guestPhone: booking.guest.phone,
  adults: booking.adults || 0,
  children: booking.children || 0,
  infants: booking.infants || 0,
  pets: booking.pets || 0,
  platform: booking.listing_site,
  platformReservationNumber: booking.platform_reservation_number,
  bookedUtc: booking.booked_date,
  canceledUtc: booking.canceled_date,
  charges: booking.charges || [],
  tags: booking.tags || [],
})

// Type exports
export type OwnerRezProperty = z.infer<typeof ownerRezPropertySchema>
export type OwnerRezBooking = z.infer<typeof ownerRezBookingSchema>
export type OwnerRezTagDefinition = z.infer<typeof ownerRezTagDefinitionSchema>