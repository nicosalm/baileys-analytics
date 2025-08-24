import { query, DbResult } from './database';
import { buildDateRangeFilter, normalizePlatformSQL } from '../utils/queryBuilders';
import { parseNumericField, parseIntField, normalizePlatformName } from '../utils/dataTransformers';
import { formatDateISO } from '../utils/dates';

// Types for report data structures
export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportFilters {
  tags?: string[];
  properties?: string[];
  platforms?: string[];
}

export interface RevenueData {
  revenue: number;
  previousRevenue: number;
  netRevenue: number;
  previousNetRevenue: number;
  expenses: number;
  previousExpenses: number;
  netProfit: number;
  previousNetProfit: number;
  profitMargin: number;
  previousProfitMargin: number;
  revenueGrowth: number;
  netRevenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
  bookings: number;
  avgBookingValue: number;
}

export interface PropertyMetric {
  propertyId: string;
  propertyName: string;
  revenue: number;
  bookings: number;
  occupancyRate: number;
  avgNightlyRate: number;
  bookedNights: number;
  availableNights: number;
  tax: number;
}

export interface OccupancyData {
  overall: number;
  byProperty: PropertyOccupancy[];
  byMonth: MonthlyOccupancy[];
  bookedNights: number;
  availableNights: number;
}

export interface PropertyOccupancy {
  propertyId: string;
  propertyName: string;
  rate: number;
  bookedNights: number;
  availableNights: number;
}

export interface MonthlyOccupancy {
  month: string;
  rate: number;
  bookedNights: number;
  availableNights: number;
}

export interface GuestData {
  metrics: {
    totalGuests: number;
    repeatGuests: number;
    repeatRate: number;
    avgStayLength: number;
    avgSpend: number;
    totalRevenue: number;
  };
  guests: GuestDetail[];
}

export interface GuestDetail {
  guestId: string;
  name: string;
  email: string;
  firstVisit: string;
  lastVisit: string;
  bookingCount: number;
  totalSpent: number;
  avgNightlyRate: number;
  avgStayLength: number;
}

export interface TaxData {
  summary: {
    totalTax: number;
    taxBreakdown: TaxBreakdownItem[];
  };
  byProperty: PropertyTaxData[];
}

export interface TaxBreakdownItem {
  name: string;
  type: string;
  amount: number;
  rate?: number;
}

export interface PropertyTaxData {
  propertyId: string;
  propertyName: string;
  totalTax: number;
  taxBreakdown: TaxBreakdownItem[];
}

export interface ReportModuleData {
  revenue?: { pl: RevenueData };
  pl?: { pl: RevenueData };
  properties?: PropertyMetric[];
  property_comparison?: PropertyMetric[];
  occupancy?: OccupancyData;
  guests?: GuestData;
  guest_segments?: GuestData;
  tax?: TaxData;
  [key: string]: any;
}

// Utility functions for building filters
function buildPropertyFilter(propertyIds: string[], paramIndex: number): string {
  return propertyIds.length > 0 
    ? `AND b.property_id = ANY($${paramIndex}::uuid[])`
    : '';
}

function buildTagFilter(tagIds: string[], paramIndex: number): string {
  return tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = b.id
        AND bt.tag_id = ANY($${paramIndex}::uuid[])
      )`
    : '';
}

function buildPlatformFilter(platforms: string[], paramIndex: number): string {
  return platforms.length > 0
    ? `AND ${normalizePlatformSQL('b.platform')} = ANY($${paramIndex}::text[])`
    : '';
}

function buildQueryParams(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters
): { params: any[]; filters: string } {
  const params: any[] = [tenantId, dateRange.from, dateRange.to];
  const filterClauses: string[] = [];
  let paramIndex = 4;

  if (filters.properties && filters.properties.length > 0) {
    filterClauses.push(buildPropertyFilter(filters.properties, paramIndex));
    params.push(filters.properties);
    paramIndex++;
  }

  if (filters.tags && filters.tags.length > 0) {
    filterClauses.push(buildTagFilter(filters.tags, paramIndex));
    params.push(filters.tags);
    paramIndex++;
  }

  if (filters.platforms && filters.platforms.length > 0) {
    filterClauses.push(buildPlatformFilter(filters.platforms, paramIndex));
    params.push(filters.platforms.map(normalizePlatformName));
    paramIndex++;
  }

  return {
    params,
    filters: filterClauses.join(' ')
  };
}

// Revenue/P&L data fetching
export async function fetchRevenueData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {}
): Promise<DbResult<RevenueData>> {
  const { params, filters: filterClause } = buildQueryParams(tenantId, dateRange, filters);
  
  // Calculate previous period dates
  const currentStart = new Date(dateRange.from);
  const currentEnd = new Date(dateRange.to);
  const periodLength = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - periodLength);

  const previousParams = [...params];
  previousParams[1] = formatDateISO(previousStart);
  previousParams[2] = formatDateISO(previousEnd);

  // Current period query
  const currentQuery = `
    SELECT 
      COALESCE(SUM(b.total_amount), 0) as revenue,
      COALESCE(SUM(b.total_amount - COALESCE(fees.total_fees, 0)), 0) as net_revenue,
      COALESCE(SUM(expenses.total_expenses), 0) as expenses,
      COUNT(DISTINCT b.id) as bookings,
      CASE 
        WHEN COUNT(DISTINCT b.id) > 0 THEN
          COALESCE(SUM(b.total_amount), 0) / COUNT(DISTINCT b.id)
        ELSE 0 
      END as avg_booking_value
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    LEFT JOIN (
      SELECT 
        booking_id, 
        SUM(amount) as total_fees
      FROM booking_charges 
      WHERE type IN ('platform_fee', 'processing_fee', 'service_fee')
      GROUP BY booking_id
    ) fees ON b.id = fees.booking_id
    LEFT JOIN (
      SELECT 
        booking_id,
        SUM(amount) as total_expenses
      FROM booking_charges
      WHERE type IN ('expense', 'cost', 'cleaning_fee')
      GROUP BY booking_id
    ) expenses ON b.id = expenses.booking_id
    WHERE b.tenant_id = $1 
      ${buildDateRangeFilter('b.arrival', 2)}
      AND b.status != 'canceled'
      AND p.active = true
      ${filterClause}
  `;

  const [currentResult, previousResult] = await Promise.all([
    query<{
      revenue: string;
      net_revenue: string;
      expenses: string;
      bookings: string;
      avg_booking_value: string;
    }>(currentQuery, params),
    query<{
      revenue: string;
      net_revenue: string;
      expenses: string;
      bookings: string;
      avg_booking_value: string;
    }>(currentQuery, previousParams)
  ]);

  if (!currentResult.success) {
    return { success: false, error: 'Failed to fetch revenue data' };
  }

  const current = currentResult.data[0] || {
    revenue: '0',
    net_revenue: '0',
    expenses: '0',
    bookings: '0',
    avg_booking_value: '0'
  };

  const previous = previousResult.success && previousResult.data[0] ? previousResult.data[0] : {
    revenue: '0',
    net_revenue: '0',
    expenses: '0',
    bookings: '0',
    avg_booking_value: '0'
  };

  const revenue = parseNumericField(current.revenue);
  const previousRevenue = parseNumericField(previous.revenue);
  const netRevenue = parseNumericField(current.net_revenue);
  const previousNetRevenue = parseNumericField(previous.net_revenue);
  const expenses = parseNumericField(current.expenses);
  const previousExpenses = parseNumericField(previous.expenses);

  const netProfit = netRevenue - expenses;
  const previousNetProfit = previousNetRevenue - previousExpenses;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const previousProfitMargin = previousNetRevenue > 0 ? (previousNetProfit / previousNetRevenue) * 100 : 0;

  const revenueGrowth = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0;
  const netRevenueGrowth = previousNetRevenue > 0 ? ((netRevenue - previousNetRevenue) / previousNetRevenue) * 100 : 0;
  const expenseGrowth = previousExpenses > 0 ? ((expenses - previousExpenses) / previousExpenses) * 100 : 0;
  const profitGrowth = previousNetProfit > 0 ? ((netProfit - previousNetProfit) / previousNetProfit) * 100 : 0;

  return {
    success: true,
    data: {
      revenue,
      previousRevenue,
      netRevenue,
      previousNetRevenue,
      expenses,
      previousExpenses,
      netProfit,
      previousNetProfit,
      profitMargin,
      previousProfitMargin,
      revenueGrowth,
      netRevenueGrowth,
      expenseGrowth,
      profitGrowth,
      bookings: parseIntField(current.bookings),
      avgBookingValue: parseNumericField(current.avg_booking_value)
    }
  };
}

// Property metrics data fetching
export async function fetchPropertyData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {}
): Promise<DbResult<PropertyMetric[]>> {
  const { params, filters: filterClause } = buildQueryParams(tenantId, dateRange, filters);

  const propertyQuery = `
    SELECT 
      p.id as property_id,
      p.name as property_name,
      COALESCE(SUM(b.total_amount), 0) as revenue,
      COUNT(DISTINCT b.id) as bookings,
      COALESCE(SUM(tax_charges.amount), 0) as tax,
      COALESCE(SUM(
        LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
      ), 0) as booked_nights,
      -- Calculate available nights based on property's first booking or query start
      COALESCE((
        SELECT 
          ($3::date - GREATEST($2::date, COALESCE(MIN(first_b.arrival), $2::date)) + 1)
        FROM bookings first_b 
        WHERE first_b.property_id = p.id 
          AND first_b.tenant_id = $1 
          AND first_b.status != 'canceled'
      ), ($3::date - $2::date + 1)) as available_nights,
      CASE
        WHEN COUNT(DISTINCT b.id) > 0 AND SUM(
          LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
        ) > 0 THEN
          SUM(b.total_amount) / SUM(
            LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
          )
        ELSE 0
      END as avg_nightly_rate
    FROM properties p
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      ${buildDateRangeFilter('b.arrival', 2)}
      AND b.status != 'canceled'
      ${filterClause}
    LEFT JOIN booking_charges tax_charges ON b.id = tax_charges.booking_id
      AND tax_charges.type = 'tax'
    WHERE p.tenant_id = $1 
      AND p.active = true
    GROUP BY p.id, p.name
    HAVING COUNT(DISTINCT b.id) > 0
    ORDER BY revenue DESC
  `;

  const result = await query<{
    property_id: string;
    property_name: string;
    revenue: string;
    bookings: string;
    tax: string;
    booked_nights: string;
    available_nights: string;
    avg_nightly_rate: string;
  }>(propertyQuery, params);

  if (!result.success) {
    return { success: false, error: 'Failed to fetch property data' };
  }

  const properties = result.data.map(row => {
    const bookedNights = parseIntField(row.booked_nights);
    const availableNights = parseIntField(row.available_nights);
    
    return {
      propertyId: row.property_id,
      propertyName: row.property_name,
      revenue: parseNumericField(row.revenue),
      bookings: parseIntField(row.bookings),
      tax: parseNumericField(row.tax),
      bookedNights,
      availableNights,
      occupancyRate: availableNights > 0 ? bookedNights / availableNights : 0,
      avgNightlyRate: parseNumericField(row.avg_nightly_rate)
    };
  });

  return { success: true, data: properties };
}

// Occupancy data fetching
export async function fetchOccupancyData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {}
): Promise<DbResult<OccupancyData>> {
  const { params, filters: filterClause } = buildQueryParams(tenantId, dateRange, filters);

  // Overall occupancy query
  const overallQuery = `
    WITH property_availability AS (
      SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(
          MIN(b.arrival),
          $2::date
        ) as available_from,
        ($3::date - GREATEST($2::date, COALESCE(MIN(b.arrival), $2::date)) + 1) as available_nights
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id, p.name
    ),
    booked_nights AS (
      SELECT
        COALESCE(SUM(
          LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
        ), 0) as total_booked
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        ${buildDateRangeFilter('b.arrival', 2)}
        AND b.status != 'canceled'
        AND p.active = true
        ${filterClause}
    )
    SELECT
      bn.total_booked as booked_nights,
      COALESCE(SUM(pa.available_nights), 0) as available_nights
    FROM property_availability pa
    CROSS JOIN booked_nights bn
    GROUP BY bn.total_booked
  `;

  // Property-level occupancy query
  const propertyQuery = `
    WITH property_availability AS (
      SELECT
        p.id,
        p.name,
        COALESCE(
          MIN(first_b.arrival),
          $2::date
        ) as available_from,
        ($3::date - GREATEST($2::date, COALESCE(MIN(first_b.arrival), $2::date)) + 1) as available_nights
      FROM properties p
      LEFT JOIN bookings first_b ON p.id = first_b.property_id
        AND first_b.tenant_id = p.tenant_id
        AND first_b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id, p.name
    ),
    property_bookings AS (
      SELECT
        p.id,
        COALESCE(SUM(
          LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
        ), 0) as booked_nights
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = $1
        ${buildDateRangeFilter('b.arrival', 2)}
        AND b.status != 'canceled'
        ${filterClause}
      WHERE p.tenant_id = $1 AND p.active = true
      GROUP BY p.id
    )
    SELECT
      pa.id as property_id,
      pa.name as property_name,
      COALESCE(pb.booked_nights, 0) as booked_nights,
      pa.available_nights as available_nights
    FROM property_availability pa
    LEFT JOIN property_bookings pb ON pa.id = pb.id
    WHERE pa.available_nights > 0
    ORDER BY pa.name
  `;

  // Monthly occupancy query
  const monthlyQuery = `
    WITH monthly_availability AS (
      SELECT
        TO_CHAR(date_series, 'YYYY-MM') as month,
        COUNT(DISTINCT p.id) as property_count
      FROM properties p
      CROSS JOIN generate_series(
        $2::date,
        $3::date,
        '1 day'::interval
      ) AS date_series
      WHERE p.tenant_id = $1
        AND p.active = true
        AND date_series >= COALESCE((
          SELECT MIN(b.arrival) 
          FROM bookings b 
          WHERE b.property_id = p.id AND b.tenant_id = $1 AND b.status != 'canceled'
        ), $2::date)
      GROUP BY TO_CHAR(date_series, 'YYYY-MM')
    ),
    monthly_bookings AS (
      SELECT
        TO_CHAR(calendar_date, 'YYYY-MM') as month,
        COUNT(DISTINCT b.property_id) as booked_properties
      FROM generate_series(
        $2::date,
        $3::date,
        '1 day'::interval
      ) as calendar_date
      JOIN bookings b ON b.tenant_id = $1
        AND b.status != 'canceled'
        AND calendar_date >= b.arrival
        AND calendar_date < b.departure
        ${filterClause}
      JOIN properties p ON b.property_id = p.id
        AND p.active = true
      GROUP BY TO_CHAR(calendar_date, 'YYYY-MM')
    )
    SELECT
      ma.month,
      COALESCE(mb.booked_properties, 0) as booked_nights,
      ma.property_count as available_nights
    FROM monthly_availability ma
    LEFT JOIN monthly_bookings mb ON ma.month = mb.month
    ORDER BY ma.month
  `;

  const [overallResult, propertyResult, monthlyResult] = await Promise.all([
    query<{ booked_nights: string; available_nights: string }>(overallQuery, params),
    query<{
      property_id: string;
      property_name: string;
      booked_nights: string;
      available_nights: string;
    }>(propertyQuery, params),
    query<{
      month: string;
      booked_nights: string;
      available_nights: string;
    }>(monthlyQuery, params)
  ]);

  if (!overallResult.success) {
    return { success: false, error: 'Failed to fetch occupancy data' };
  }

  const overall = overallResult.data[0] || { booked_nights: '0', available_nights: '0' };
  const bookedNights = parseIntField(overall.booked_nights);
  const availableNights = parseIntField(overall.available_nights);
  const overallRate = availableNights > 0 ? bookedNights / availableNights : 0;

  const byProperty = propertyResult.success ? propertyResult.data.map(row => {
    const propBookedNights = parseIntField(row.booked_nights);
    const propAvailableNights = parseIntField(row.available_nights);
    
    return {
      propertyId: row.property_id,
      propertyName: row.property_name,
      rate: propAvailableNights > 0 ? propBookedNights / propAvailableNights : 0,
      bookedNights: propBookedNights,
      availableNights: propAvailableNights
    };
  }) : [];

  const byMonth = monthlyResult.success ? monthlyResult.data.map(row => {
    const monthBookedNights = parseIntField(row.booked_nights);
    const monthAvailableNights = parseIntField(row.available_nights);
    
    return {
      month: row.month,
      rate: monthAvailableNights > 0 ? monthBookedNights / monthAvailableNights : 0,
      bookedNights: monthBookedNights,
      availableNights: monthAvailableNights
    };
  }) : [];

  return {
    success: true,
    data: {
      overall: overallRate,
      byProperty,
      byMonth,
      bookedNights,
      availableNights
    }
  };
}

// Guest data fetching
export async function fetchGuestData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {},
  includeDetails: boolean = false
): Promise<DbResult<GuestData>> {
  const { params, filters: filterClause } = buildQueryParams(tenantId, dateRange, filters);

  // Guest metrics query
  const metricsQuery = `
    WITH guest_bookings AS (
      SELECT 
        COALESCE(b.guest_email, CONCAT('guest_', LOWER(REPLACE(b.guest_name, ' ', '_')))) as guest_id,
        b.guest_name,
        b.guest_email,
        COUNT(*) as booking_count,
        SUM(b.total_amount) as total_spent,
        AVG(b.total_amount) as avg_spend,
        AVG(b.departure - b.arrival) as avg_stay_length,
        MIN(b.arrival) as first_visit,
        MAX(b.arrival) as last_visit,
        AVG(b.total_amount / (b.departure - b.arrival)) as avg_nightly_rate
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1 
        ${buildDateRangeFilter('b.arrival', 2)}
        AND b.status != 'canceled'
        AND p.active = true
        AND b.guest_name IS NOT NULL
        ${filterClause}
      GROUP BY guest_id, b.guest_name, b.guest_email
    ),
    all_guest_history AS (
      SELECT 
        COALESCE(b.guest_email, CONCAT('guest_', LOWER(REPLACE(b.guest_name, ' ', '_')))) as guest_id,
        COUNT(*) as total_bookings
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1 
        AND b.status != 'canceled'
        AND p.active = true
        AND b.guest_name IS NOT NULL
      GROUP BY guest_id
    )
    SELECT 
      COUNT(DISTINCT gb.guest_id) as total_guests,
      COUNT(DISTINCT CASE WHEN agh.total_bookings > 1 THEN gb.guest_id END) as repeat_guests,
      COALESCE(
        COUNT(DISTINCT CASE WHEN agh.total_bookings > 1 THEN gb.guest_id END)::float /
        NULLIF(COUNT(DISTINCT gb.guest_id), 0),
        0
      ) * 100 as repeat_rate,
      AVG(gb.avg_stay_length) as avg_stay_length,
      AVG(gb.avg_spend) as avg_spend,
      SUM(gb.total_spent) as total_revenue
    FROM guest_bookings gb
    LEFT JOIN all_guest_history agh ON gb.guest_id = agh.guest_id
  `;

  const metricsResult = await query<{
    total_guests: string;
    repeat_guests: string;
    repeat_rate: string;
    avg_stay_length: string;
    avg_spend: string;
    total_revenue: string;
  }>(metricsQuery, params);

  if (!metricsResult.success) {
    return { success: false, error: 'Failed to fetch guest metrics' };
  }

  const metrics = metricsResult.data[0] || {
    total_guests: '0',
    repeat_guests: '0',
    repeat_rate: '0',
    avg_stay_length: '0',
    avg_spend: '0',
    total_revenue: '0'
  };

  let guests: GuestDetail[] = [];

  if (includeDetails) {
    // Detailed guest query
    const guestDetailQuery = `
      WITH guest_bookings AS (
        SELECT 
          COALESCE(b.guest_email, CONCAT('guest_', LOWER(REPLACE(b.guest_name, ' ', '_')))) as guest_id,
          b.guest_name,
          b.guest_email,
          COUNT(*) as booking_count,
          SUM(b.total_amount) as total_spent,
          AVG(b.departure - b.arrival) as avg_stay_length,
          MIN(b.arrival) as first_visit,
          MAX(b.arrival) as last_visit,
          AVG(b.total_amount / (b.departure - b.arrival)) as avg_nightly_rate
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        WHERE b.tenant_id = $1 
          ${buildDateRangeFilter('b.arrival', 2)}
          AND b.status != 'canceled'
          AND p.active = true
          AND b.guest_name IS NOT NULL
          ${filterClause}
        GROUP BY guest_id, b.guest_name, b.guest_email
      )
      SELECT *
      FROM guest_bookings
      ORDER BY total_spent DESC
      LIMIT 100
    `;

    const guestDetailResult = await query<{
      guest_id: string;
      guest_name: string;
      guest_email: string;
      booking_count: string;
      total_spent: string;
      avg_stay_length: string;
      first_visit: string;
      last_visit: string;
      avg_nightly_rate: string;
    }>(guestDetailQuery, params);

    if (guestDetailResult.success) {
      guests = guestDetailResult.data.map(row => ({
        guestId: row.guest_id,
        name: row.guest_name || 'Unknown',
        email: row.guest_email || '',
        firstVisit: row.first_visit,
        lastVisit: row.last_visit,
        bookingCount: parseIntField(row.booking_count),
        totalSpent: parseNumericField(row.total_spent),
        avgNightlyRate: parseNumericField(row.avg_nightly_rate),
        avgStayLength: parseNumericField(row.avg_stay_length)
      }));
    }
  }

  return {
    success: true,
    data: {
      metrics: {
        totalGuests: parseIntField(metrics.total_guests),
        repeatGuests: parseIntField(metrics.repeat_guests),
        repeatRate: parseNumericField(metrics.repeat_rate),
        avgStayLength: parseNumericField(metrics.avg_stay_length),
        avgSpend: parseNumericField(metrics.avg_spend),
        totalRevenue: parseNumericField(metrics.total_revenue)
      },
      guests
    }
  };
}

// Tax data fetching
export async function fetchTaxData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {}
): Promise<DbResult<TaxData>> {
  const { params, filters: filterClause } = buildQueryParams(tenantId, dateRange, filters);

  // Tax summary query
  const summaryQuery = `
    SELECT 
      COALESCE(SUM(bc.amount), 0) as total_tax,
      bc.description as tax_name,
      bc.type as tax_type,
      SUM(bc.amount) as tax_amount
    FROM booking_charges bc
    JOIN bookings b ON bc.booking_id = b.id
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1 
      ${buildDateRangeFilter('b.arrival', 2)}
      AND b.status != 'canceled'
      AND p.active = true
      AND bc.type = 'tax'
      ${filterClause}
    GROUP BY bc.description, bc.type
    ORDER BY tax_amount DESC
  `;

  // Property-level tax query
  const propertyQuery = `
    SELECT 
      p.id as property_id,
      p.name as property_name,
      COALESCE(SUM(bc.amount), 0) as total_tax,
      bc.description as tax_name,
      bc.type as tax_type,
      SUM(bc.amount) as tax_amount
    FROM properties p
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      ${buildDateRangeFilter('b.arrival', 2)}
      AND b.status != 'canceled'
      ${filterClause}
    LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      AND bc.type = 'tax'
    WHERE p.tenant_id = $1 
      AND p.active = true
    GROUP BY p.id, p.name, bc.description, bc.type
    HAVING COALESCE(SUM(bc.amount), 0) > 0
    ORDER BY p.name, tax_amount DESC
  `;

  const [summaryResult, propertyResult] = await Promise.all([
    query<{
      total_tax: string;
      tax_name: string;
      tax_type: string;
      tax_amount: string;
    }>(summaryQuery, params),
    query<{
      property_id: string;
      property_name: string;
      total_tax: string;
      tax_name: string;
      tax_type: string;
      tax_amount: string;
    }>(propertyQuery, params)
  ]);

  if (!summaryResult.success) {
    return { success: false, error: 'Failed to fetch tax data' };
  }

  // Process summary data
  let totalTax = 0;
  const taxBreakdownMap = new Map<string, TaxBreakdownItem>();

  summaryResult.data.forEach(row => {
    const amount = parseNumericField(row.tax_amount);
    totalTax += amount;
    
    const key = `${row.tax_type}-${row.tax_name}`;
    if (!taxBreakdownMap.has(key)) {
      taxBreakdownMap.set(key, {
        name: row.tax_name || 'Tax',
        type: row.tax_type,
        amount: 0
      });
    }
    
    const item = taxBreakdownMap.get(key)!;
    item.amount += amount;
  });

  const taxBreakdown = Array.from(taxBreakdownMap.values());

  // Process property data
  const propertyTaxMap = new Map<string, PropertyTaxData>();

  if (propertyResult.success) {
    propertyResult.data.forEach(row => {
      const propertyId = row.property_id;
      if (!propertyTaxMap.has(propertyId)) {
        propertyTaxMap.set(propertyId, {
          propertyId,
          propertyName: row.property_name,
          totalTax: 0,
          taxBreakdown: []
        });
      }

      const propertyTax = propertyTaxMap.get(propertyId)!;
      const amount = parseNumericField(row.tax_amount);
      
      if (amount > 0) {
        propertyTax.totalTax += amount;
        propertyTax.taxBreakdown.push({
          name: row.tax_name || 'Tax',
          type: row.tax_type,
          amount
        });
      }
    });
  }

  const byProperty = Array.from(propertyTaxMap.values());

  return {
    success: true,
    data: {
      summary: {
        totalTax,
        taxBreakdown
      },
      byProperty
    }
  };
}

// Main function to fetch all report data
export async function fetchReportData(
  modules: string[],
  dateRange: ReportDateRange,
  tenantId: string,
  filters: ReportFilters = {}
): Promise<ReportModuleData> {
  const data: ReportModuleData = {};

  // Fetch data for each requested module
  const promises = modules.map(async (module) => {
    try {
      switch (module) {
        case 'revenue':
        case 'pl':
          const revenueResult = await fetchRevenueData(tenantId, dateRange, filters);
          if (revenueResult.success) {
            data[module] = { pl: revenueResult.data };
          } else {
            (data as any)[module] = { error: (revenueResult as { success: false; error: string }).error };
          }
          break;

        case 'properties':
        case 'property_comparison':
          const propertyResult = await fetchPropertyData(tenantId, dateRange, filters);
          if (propertyResult.success) {
            data[module] = propertyResult.data;
          } else {
            (data as any)[module] = { error: (propertyResult as { success: false; error: string }).error };
          }
          break;

        case 'occupancy':
          const occupancyResult = await fetchOccupancyData(tenantId, dateRange, filters);
          if (occupancyResult.success) {
            data[module] = occupancyResult.data;
          } else {
            (data as any)[module] = { error: (occupancyResult as { success: false; error: string }).error };
          }
          break;

        case 'guests':
        case 'guest_segments':
          const guestResult = await fetchGuestData(tenantId, dateRange, filters, true);
          if (guestResult.success) {
            data[module] = guestResult.data;
          } else {
            (data as any)[module] = { error: (guestResult as { success: false; error: string }).error };
          }
          break;

        case 'tax':
          const taxResult = await fetchTaxData(tenantId, dateRange, filters);
          if (taxResult.success) {
            data[module] = taxResult.data;
          } else {
            (data as any)[module] = { error: (taxResult as { success: false; error: string }).error };
          }
          break;

        default:
          // For any other modules, return empty data
          data[module] = {};
          break;
      }
    } catch (error) {
      data[module] = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  await Promise.all(promises);

  return data;
}

// Utility function for simple metric fetching (used by scheduler)
export async function fetchSimpleReportData(
  modules: string[],
  dateRange: ReportDateRange,
  tenantId: string
): Promise<any> {
  const data: any = {
    dateRange,
    modules: {}
  };

  for (const module of modules) {
    try {
      switch (module) {
        case 'revenue':
        case 'pl':
          const revenueQuery = `
            SELECT 
              SUM(total_amount) as revenue,
              COUNT(*) as bookings
            FROM bookings b
            WHERE tenant_id = $1 
              ${buildDateRangeFilter('arrival', 2)}
              AND status != 'canceled'
          `;
          const revenueResult = await query<any>(revenueQuery, [tenantId, dateRange.from, dateRange.to]);
          if (revenueResult.success && revenueResult.data.length > 0) {
            const row = revenueResult.data[0];
            data.modules[module] = {
              revenue: parseNumericField(row.revenue),
              bookings: parseIntField(row.bookings)
            };
          }
          break;

        case 'occupancy':
          const occupancyQuery = `
            SELECT 
              COUNT(DISTINCT property_id) as properties,
              COUNT(*) as total_bookings
            FROM bookings b
            WHERE tenant_id = $1 
              ${buildDateRangeFilter('arrival', 2)}
              AND ${buildDateRangeFilter('departure', 4)}
              AND status != 'canceled'
          `;
          const occupancyResult = await query<any>(occupancyQuery, [tenantId, dateRange.from, dateRange.to, dateRange.from, dateRange.to]);
          if (occupancyResult.success && occupancyResult.data.length > 0) {
            const row = occupancyResult.data[0];
            data.modules[module] = {
              properties: parseIntField(row.properties),
              totalBookings: parseIntField(row.total_bookings)
            };
          }
          break;

        case 'guests':
          const guestsQuery = `
            SELECT 
              COUNT(DISTINCT guest_email) as totalGuests,
              AVG(total_amount) as avgSpend
            FROM bookings b
            WHERE tenant_id = $1 
              ${buildDateRangeFilter('arrival', 2)}
              AND status != 'canceled'
          `;
          const guestsResult = await query<any>(guestsQuery, [tenantId, dateRange.from, dateRange.to]);
          if (guestsResult.success && guestsResult.data.length > 0) {
            const row = guestsResult.data[0];
            data.modules[module] = {
              metrics: {
                totalGuests: parseIntField(row.totalguests),
                avgSpend: parseNumericField(row.avgspend)
              }
            };
          }
          break;
      }
    } catch (error) {
      data.modules[module] = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return data;
}