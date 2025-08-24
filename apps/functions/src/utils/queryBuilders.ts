export interface QueryParams {
  tenantId: string;
  fromDate?: string;
  toDate?: string;
  tagIds?: string[];
  seasonIds?: string[];
  propertyIds?: string[];
  guestEmail?: string;
  platforms?: string[];
}

export const buildDateRangeFilter = (fromAlias: string = 'arrival', paramOffset: number = 2): string => {
  return `AND b.${fromAlias} >= $${paramOffset}::date AND b.${fromAlias} <= $${paramOffset + 1}::date`;
};

export const buildStatusFilter = (excludeCanceled: boolean = true): string => {
  return excludeCanceled ? `AND b.status != 'canceled'` : '';
};

export const buildTagFilter = (paramOffset: number = 4): string => {
  return `AND EXISTS (
    SELECT 1 FROM booking_tags bt
    WHERE bt.booking_id = b.id
    AND bt.tag_id = ANY($${paramOffset}::uuid[])
  )`;
};

export const buildSeasonFilter = (paramOffset: number = 5): string => {
  return `AND EXISTS (
    SELECT 1 FROM season_bookings sb
    WHERE sb.booking_id = b.id
    AND sb.season_id = ANY($${paramOffset}::uuid[])
  )`;
};

export const buildPropertyFilter = (paramOffset: number = 4, alias: string = 'b'): string => {
  return `AND ${alias}.property_id = ANY($${paramOffset}::uuid[])`;
};

export const buildGuestFilter = (paramOffset: number = 3): string => {
  return `AND (
    ($${paramOffset} = '' AND (guest_email IS NULL OR guest_email = ''))
    OR (guest_email = $${paramOffset})
  )`;
};

export const buildPlatformFilter = (platforms: string[], paramOffset: number): string => {
  if (platforms.length === 0) return '';
  
  const platformConditions = platforms.map(p => 
    p === 'Direct' 
      ? `(b.platform IS NULL OR b.platform = '' OR b.platform = 'Direct')`
      : `b.platform = $${paramOffset}::text`
  ).join(' OR ');
  
  return `AND (${platformConditions})`;
};

export const buildQueryParams = (params: QueryParams): any[] => {
  const queryParams: any[] = [params.tenantId];
  
  if (params.fromDate) queryParams.push(params.fromDate);
  if (params.toDate) queryParams.push(params.toDate);
  if (params.tagIds && params.tagIds.length > 0) queryParams.push(params.tagIds);
  if (params.seasonIds && params.seasonIds.length > 0) queryParams.push(params.seasonIds);
  if (params.propertyIds && params.propertyIds.length > 0) queryParams.push(params.propertyIds);
  if (params.guestEmail) queryParams.push(params.guestEmail);
  if (params.platforms && params.platforms.length > 0) {
    params.platforms.filter(p => p !== 'Direct').forEach(p => queryParams.push(p));
  }
  
  return queryParams;
};

export const normalizePlatformSQL = (columnName: string = 'platform'): string => {
  return `CASE
    WHEN ${columnName} IS NULL OR ${columnName} = '' THEN 'Direct'
    WHEN LOWER(${columnName}) LIKE '%airbnb%' THEN 'Airbnb'
    WHEN LOWER(${columnName}) LIKE '%vrbo%' OR LOWER(${columnName}) LIKE '%homeaway%' THEN 'VRBO'
    WHEN LOWER(${columnName}) LIKE '%booking.com%' THEN 'Booking.com'
    ELSE ${columnName}
  END`;
};

export const buildCommonBookingJoins = (): string => {
  return `
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN property_tax_configs ptc ON p.id = ptc.property_id
  `;
};

export const buildPaginationClause = (limit: number, offset: number): string => {
  return `LIMIT ${limit} OFFSET ${offset}`;
};

export const buildBookingChargesSubquery = (bookingIdColumn: string = 'b.id'): string => {
  return `(SELECT SUM(amount) FROM booking_charges WHERE booking_id = ${bookingIdColumn} AND type = 'tax')`;
};

export const buildMonthlyGrouping = (dateColumn: string = 'arrival'): string => {
  return `TO_CHAR(${dateColumn}, 'YYYY-MM')`;
};

export const buildWeeklyGrouping = (dateColumn: string = 'arrival'): string => {
  return `DATE_TRUNC('week', ${dateColumn})::date`;
};

export const buildPropertyActiveFilter = (alias: string = 'p'): string => {
  return `AND ${alias}.active = true`;
};

export const buildTenantFilter = (paramOffset: number = 1, alias: string = 'b'): string => {
  return `${alias}.tenant_id = $${paramOffset}`;
};

export const buildBookingAmountAggregation = (alias: string = 'b'): string => {
  return `COALESCE(SUM(${alias}.total_amount), 0)`;
};

export const buildBookingCountAggregation = (alias: string = 'b'): string => {
  return `COUNT(DISTINCT ${alias}.id)`;
};

export const buildAvailableNightsCalculation = (fromDate: string, toDate: string): string => {
  return `(${toDate}::date - ${fromDate}::date + 1)`;
};

export const buildOccupancyRateCalculation = (bookedNights: string, availableNights: string): string => {
  return `CASE WHEN ${availableNights} > 0 THEN ROUND((${bookedNights}::numeric / ${availableNights}) * 100, 1) ELSE 0 END`;
};

export const buildRevenueGrowthCalculation = (current: string, previous: string): string => {
  return `CASE WHEN ${previous} > 0 THEN ROUND(((${current} - ${previous}) / ${previous}) * 100, 2) ELSE 0 END`;
};