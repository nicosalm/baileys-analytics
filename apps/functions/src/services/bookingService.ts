import { query } from './database';
import { buildDateRangeFilter, buildStatusFilter, normalizePlatformSQL } from '../utils/queryBuilders';
import { parseNumericField, parseIntField, createGuestId } from '../utils/dataTransformers';

export interface BookingRow {
  id: string;
  ownerrez_booking_id: string;
  property_id: string;
  property_name: string;
  guest_name: string;
  guest_email?: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  total_amount: string;
  status: string;
  platform?: string;
  booked_utc: string;
}

export interface BookingChargeRow {
  id: string;
  type: string;
  description: string;
  amount: string;
  is_taxable: boolean;
}

export interface BookingTagRow {
  id: string;
  name: string;
  type: string;
}

export interface BookingWithDetails extends BookingRow {
  charges?: BookingChargeRow[];
  tags?: BookingTagRow[];
}

export interface BookingSummaryRow {
  total_revenue: string;
  total_tax: string;
  total_bookings: string;
  avg_nightly_rate: string;
}

export interface PropertySummaryRow {
  property_id: string;
  property_name: string;
  revenue: string;
  bookings: string;
  tax: string;
}

/**
 * Get a single booking by ID with property details
 */
export async function getBookingById(bookingId: string, tenantId: string) {
  return query<BookingRow>(
    `SELECT
      b.id,
      b.ownerrez_booking_id,
      b.property_id,
      p.name as property_name,
      b.guest_name,
      b.guest_email,
      b.arrival,
      b.departure,
      b.adults,
      b.children,
      b.total_amount,
      b.status,
      b.platform,
      b.booked_utc
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.id = $1 AND b.tenant_id = $2`,
    [bookingId, tenantId]
  );
}

/**
 * Get booking charges for a specific booking
 */
export async function getBookingCharges(bookingId: string) {
  return query<BookingChargeRow>(
    `SELECT id, type, description, amount, is_taxable
     FROM booking_charges
     WHERE booking_id = $1
     ORDER BY position`,
    [bookingId]
  );
}

/**
 * Get booking tags for a specific booking
 */
export async function getBookingTags(bookingId: string) {
  return query<BookingTagRow>(
    `SELECT t.id, t.name, t.type
     FROM tags t
     JOIN booking_tags bt ON t.id = bt.tag_id
     WHERE bt.booking_id = $1`,
    [bookingId]
  );
}

/**
 * Get bookings for a date range with optional filters
 */
export async function getBookingsInDateRange(
  tenantId: string,
  startDate: string,
  endDate: string,
  additionalFilters: string = ''
) {
  const baseQuery = `
    SELECT
      b.id,
      b.property_id,
      p.name as property_name,
      b.guest_name,
      b.guest_email,
      b.arrival,
      b.departure,
      b.total_amount,
      b.status,
      ${normalizePlatformSQL('b.platform')} as platform
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
      AND b.arrival <= $3::date
      AND b.departure >= $2::date
      ${buildStatusFilter()}
      ${additionalFilters}
    ORDER BY b.arrival`;

  return query<BookingRow>(baseQuery, [tenantId, startDate, endDate]);
}

/**
 * Get booking summary metrics for a date range
 */
export async function getBookingSummary(
  tenantId: string,
  startDate: string,
  endDate: string,
  additionalFilters: string = ''
) {
  const summaryQuery = `
    SELECT
      COALESCE(SUM(b.total_amount), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_tax,
      COUNT(DISTINCT b.id) as total_bookings,
      CASE
        WHEN SUM(LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)) > 0 THEN
          SUM(b.total_amount) / SUM(LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date))
        ELSE 0
      END as avg_nightly_rate
    FROM bookings b
    LEFT JOIN booking_charges bc ON b.id = bc.booking_id
    WHERE b.tenant_id = $1
      AND b.arrival <= $3::date
      AND b.departure >= $2::date
      ${buildStatusFilter()}
      ${additionalFilters}`;

  return query<BookingSummaryRow>(summaryQuery, [tenantId, startDate, endDate]);
}

/**
 * Get property-wise booking summary for a date range
 */
export async function getPropertyBookingSummary(
  tenantId: string,
  startDate: string,
  endDate: string,
  additionalFilters: string = ''
) {
  const propertyQuery = `
    SELECT
      p.id as property_id,
      p.name as property_name,
      COALESCE(SUM(b.total_amount), 0) as revenue,
      COUNT(DISTINCT b.id) as bookings,
      COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as tax
    FROM properties p
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.arrival <= $3::date
      AND b.departure >= $2::date
      ${buildStatusFilter().replace('AND b.', 'AND b.')}
      ${additionalFilters}
    LEFT JOIN booking_charges bc ON b.id = bc.booking_id
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.id, p.name
    HAVING COUNT(DISTINCT b.id) > 0
    ORDER BY revenue DESC`;

  return query<PropertySummaryRow>(propertyQuery, [tenantId, startDate, endDate]);
}

/**
 * Transform a booking row to the standard API format
 */
export function transformBookingToAPI(booking: BookingRow) {
  return {
    id: booking.id,
    ownerrezBookingId: booking.ownerrez_booking_id,
    propertyId: booking.property_id,
    propertyName: booking.property_name,
    guestId: createGuestId(booking.guest_name, booking.guest_email),
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    arrival: booking.arrival,
    departure: booking.departure,
    adults: booking.adults,
    children: booking.children,
    totalAmount: parseNumericField(booking.total_amount),
    status: booking.status,
    platform: booking.platform,
    bookedDate: booking.booked_utc
  };
}

/**
 * Transform booking charges to API format
 */
export function transformChargesToAPI(charges: BookingChargeRow[]) {
  return charges.map(c => ({
    id: c.id,
    type: c.type,
    description: c.description,
    amount: parseNumericField(c.amount),
    isTaxable: c.is_taxable
  }));
}

/**
 * Transform booking summary to API format
 */
export function transformSummaryToAPI(summary: BookingSummaryRow) {
  return {
    totalRevenue: parseNumericField(summary.total_revenue),
    totalTax: parseNumericField(summary.total_tax),
    totalBookings: parseIntField(summary.total_bookings),
    avgNightlyRate: parseNumericField(summary.avg_nightly_rate)
  };
}

/**
 * Transform property summary to API format
 */
export function transformPropertySummaryToAPI(properties: PropertySummaryRow[]) {
  return properties.map(p => ({
    propertyId: p.property_id,
    propertyName: p.property_name,
    revenue: parseNumericField(p.revenue),
    bookings: parseIntField(p.bookings),
    tax: parseNumericField(p.tax)
  }));
}