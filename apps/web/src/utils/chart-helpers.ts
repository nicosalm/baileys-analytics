import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import { formatCurrency, formatCompactCurrency, formatPercentage } from './formatters'
import { differenceInDays, parseISO } from 'date-fns'

export interface ChartConfig {
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  animate?: boolean
  onClick?: (data: any) => void
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  height: 256,
  showGrid: true,
  showTooltip: true,
  showLegend: false,
  animate: true
}

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

export const tooltipFormatters = {
  currency: (value: number) => formatCurrency(value),
  percentage: (value: number) => formatPercentage(value, 1),
  number: (value: number) => value.toLocaleString(),
  occupancy: (value: number) => `${(value * 100).toFixed(1)}%`
}

export const getMetricColor = (metric: keyof typeof METRIC_COLORS): string => {
  return METRIC_COLORS[metric] || CHART_COLORS[0]
}

export const getChartColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export interface PieChartData {
  name: string
  value: number
  percentage?: number
  color?: string
}

export const transformToPieData = (
  data: Record<string, number>,
  colorMap?: Record<string, string>
): PieChartData[] => {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0)
  
  return Object.entries(data)
    .map(([name, value], index) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: colorMap?.[name] || getChartColor(index)
    }))
    .sort((a, b) => b.value - a.value)
}

export interface TimeSeriesData {
  date: string
  value: number
  label?: string
}

export const transformToTimeSeries = (
  data: Array<{ date: string | Date; value: number }>,
  labelFormat: 'short' | 'full' = 'short'
): TimeSeriesData[] => {
  return data.map(item => {
    const date = typeof item.date === 'string' ? parseISO(item.date) : item.date
    const label = labelFormat === 'short'
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      value: item.value,
      label
    }
  })
}

export const calculateChartDomain = (
  data: number[],
  padding = 0.1
): [number, number] => {
  if (data.length === 0) return [0, 100]
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min
  
  return [
    Math.max(0, min - range * padding),
    max + range * padding
  ]
}

export const groupByPeriod = (
  data: Array<{ date: string | Date; value: number }>,
  period: 'day' | 'week' | 'month' | 'quarter' | 'year'
): Array<{ period: string; value: number; count: number }> => {
  const grouped = new Map<string, { sum: number; count: number }>()
  
  data.forEach(item => {
    const date = typeof item.date === 'string' ? parseISO(item.date) : item.date
    let periodKey: string
    
    switch (period) {
      case 'day':
        periodKey = date.toISOString().split('T')[0]
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        periodKey = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1
        periodKey = `${date.getFullYear()}-Q${quarter}`
        break
      case 'year':
        periodKey = String(date.getFullYear())
        break
    }
    
    const current = grouped.get(periodKey) || { sum: 0, count: 0 }
    grouped.set(periodKey, {
      sum: current.sum + item.value,
      count: current.count + 1
    })
  })
  
  return Array.from(grouped.entries())
    .map(([period, { sum, count }]) => ({
      period,
      value: sum,
      count
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

export const calculateTrendLine = (
  data: Array<{ x: number; y: number }>
): { slope: number; intercept: number } => {
  if (data.length < 2) return { slope: 0, intercept: 0 }
  
  const n = data.length
  const sumX = data.reduce((sum, point) => sum + point.x, 0)
  const sumY = data.reduce((sum, point) => sum + point.y, 0)
  const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0)
  const sumX2 = data.reduce((sum, point) => sum + point.x * point.x, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  return { slope, intercept }
}

export interface ComparisonData {
  label: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export const generateComparisonData = (
  current: Record<string, number>,
  previous: Record<string, number>
): ComparisonData[] => {
  const labels = new Set([...Object.keys(current), ...Object.keys(previous)])
  
  return Array.from(labels).map(label => {
    const currentValue = current[label] || 0
    const previousValue = previous[label] || 0
    const change = currentValue - previousValue
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0
    
    return {
      label,
      current: currentValue,
      previous: previousValue,
      change,
      changePercent
    }
  })
}


export const exportChartData = (
  data: any[],
  columns: Array<{ key: string; label: string; format?: (value: any) => string }>
): string => {
  const headers = columns.map(col => col.label).join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key]
      return col.format ? col.format(value) : value
    }).join(',')
  )
  
  return [headers, ...rows].join('\n')
}

export type DateGranularity = 'Daily' | 'Weekly' | 'Monthly';

export function detectGranularity(data: any[], dateField = 'month'): DateGranularity {
  if (!data || data.length === 0) return 'Monthly';
  
  const firstDate = data[0][dateField];
  if (!firstDate) return 'Monthly';
  
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
    const secondDate = data[1][dateField];
    if (secondDate && secondDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date1 = parseISO(firstDate);
      const date2 = parseISO(secondDate);
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

export function formatChartData<T extends Record<string, any>>(
  data: T[],
  dateField = 'month'
): T[] {
  return data.map(item => ({
    ...item,
    [dateField]: formatChartDate(item[dateField])
  }));
}