export const parseNumericField = (value: any, defaultValue: number = 0): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const parseIntField = (value: any, defaultValue: number = 0): number => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const createGuestId = (name: string, email?: string | null): string => {
  return `${name}|${email || ''}`;
};

export const parseGuestId = (id: string): { name: string; email: string | null } => {
  const [name, email] = id.split('|');
  return {
    name: name || '',
    email: email || null
  };
};

export const normalizePlatformName = (platform: string | null): string => {
  if (!platform || platform === '') return 'Direct';
  
  const lower = platform.toLowerCase();
  if (lower.includes('airbnb')) return 'Airbnb';
  if (lower.includes('vrbo') || lower.includes('homeaway')) return 'VRBO';
  if (lower.includes('booking.com')) return 'Booking.com';
  
  return platform;
};

export const calculateDaysDifference = (from: string | Date, to: string | Date): number => {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
};

export const groupByKey = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

export const sumBy = <T>(array: T[], key: keyof T): number => {
  return array.reduce((sum, item) => {
    const value = item[key];
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return sum + (isNaN(numValue) ? 0 : numValue);
  }, 0);
};

export const parseRowWithNumericFields = <T extends Record<string, any>>(
  row: Record<string, any>,
  numericFields: string[]
): T => {
  const result = { ...row } as T;
  
  numericFields.forEach(field => {
    if (field in row) {
      result[field as keyof T] = parseNumericField(row[field]) as any;
    }
  });
  
  return result;
};

export const transformBookingRow = (row: any) => ({
  ...row,
  total_amount: parseNumericField(row.total_amount),
  taxes: parseNumericField(row.taxes),
  fees: parseNumericField(row.fees),
  nights: parseIntField(row.nights),
  platform: normalizePlatformName(row.platform)
});

export const transformPropertyRow = (row: any) => ({
  ...row,
  revenue: parseNumericField(row.revenue),
  bookings: parseIntField(row.bookings),
  occupancy_rate: parseNumericField(row.occupancy_rate),
  adr: parseNumericField(row.adr)
});