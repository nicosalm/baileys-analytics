import { getChartColor } from '@/lib/theme'
import { formatCompactCurrency, formatPercentage } from './formatters'
import { differenceInDays, parseISO } from 'date-fns'

export const chartFormatters = {
  currency: (value: number) => formatCompactCurrency(value),
  percentage: (value: number) => formatPercentage(value, 1),
  number: (value: number) => value.toLocaleString(),
  compact: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }
}

export { getChartColor }

export interface ComparisonData {
  label: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export type DateGranularity = 'Daily' | 'Weekly' | 'Monthly';

export function detectGranularity(data: Array<Record<string, string | number | undefined>>, dateField = 'month'): DateGranularity {
  if (!data || data.length === 0) return 'Monthly';
  
  const rawFirst = data[0][dateField];
  if (!rawFirst || typeof rawFirst !== 'string') return 'Monthly';
  const firstDate = rawFirst;

  // Check if it's explicitly marked as weekly (contains "Week of")
  if (firstDate.includes('Week of')) {
    return 'Weekly';
  }
  
  // Check if it's a monthly format (YYYY-MM)
  if (firstDate.match(/^\d{4}-\d{2}$/)) {
    return 'Monthly';
  }
  
  // For YYYY-MM-DD format, we need to check the interval between dates
  if (firstDate.match(/^\d{4}-\d{2}-\d{2}$/) && data.length >= 2) {
    const rawSecond = data[1][dateField];
    if (rawSecond && typeof rawSecond === 'string' && rawSecond.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date1 = parseISO(firstDate);
      const date2 = parseISO(rawSecond);
      // Use date-fns for consistent date difference calculation
      const diffDays = differenceInDays(date2, date1);
      
      // Weekly data: exactly 7 days between points
      if (diffDays === 7) {
        return 'Weekly';
      }
      // Daily data: 1 day between points (allowing 2 for weekends/gaps)
      if (diffDays >= 1 && diffDays <= 2) {
        return 'Daily';
      }
      // Monthly data: 28-31 days (varies by month)
      if (diffDays >= 28 && diffDays <= 31) {
        return 'Monthly';
      }
    }
  }
  
  // Check if it's a daily format (YYYY-MM-DD or MM/DD) as fallback
  if (firstDate.match(/^\d{4}-\d{2}-\d{2}$/) || firstDate.match(/^\d{2}\/\d{2}$/)) {
    return 'Daily';
  }
  
  // Default to monthly
  return 'Monthly';
}

export function formatChartDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  
  // Check if it's a daily format (YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  // Check if it's a monthly format (YYYY-MM)
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  
  // Return as-is if already formatted or unrecognized
  return dateStr;
}

export function formatChartData<T extends Record<string, string | number | undefined | null>>(
  data: T[],
  dateField = 'month'
): T[] {
  return data.map(item => ({
    ...item,
    [dateField]: typeof item[dateField] === 'string' ? formatChartDate(item[dateField]) : item[dateField]
  }));
}