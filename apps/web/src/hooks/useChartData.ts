import { useMemo } from 'react'
import {
  transformToPieData,
  transformToTimeSeries,
  groupByPeriod,
  generateComparisonData,
  calculateTrendLine,
  PieChartData,
  ComparisonData
} from '@/utils/chart-helpers'

// Hook for pie/donut chart data
export function usePieChartData(
  data: Record<string, number> | undefined,
  colorMap?: Record<string, string>
): {
  chartData: PieChartData[]
  total: number
  isEmpty: boolean
} {
  return useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return { chartData: [], total: 0, isEmpty: true }
    }
    
    const chartData = transformToPieData(data, colorMap)
    const total = chartData.reduce((sum, item) => sum + item.value, 0)
    
    return { chartData, total, isEmpty: false }
  }, [data, colorMap])
}

// Hook for time series data
export function useTimeSeriesData(
  data: Array<{ date: string | Date; value: number }> | undefined,
  options: {
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year'
    labelFormat?: 'short' | 'full'
    calculateTrend?: boolean
  } = {}
) {
  return useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], isEmpty: true }
    }
    
    const { period, labelFormat = 'short', calculateTrend = false } = options
    
    // Transform to time series format
    const chartData = transformToTimeSeries(data, labelFormat)
    
    // Aggregate by period if specified
    const aggregatedData = period ? groupByPeriod(data, period) : undefined
    
    // Calculate trend if requested
    let trend = undefined
    if (calculateTrend && chartData.length >= 2) {
      const trendData = chartData.map((item, index) => ({
        x: index,
        y: item.value
      }))
      const { slope, intercept } = calculateTrendLine(trendData)
      trend = {
        slope,
        intercept,
        direction: slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'flat'
      }
    }
    
    return { chartData, aggregatedData, trend, isEmpty: false }
  }, [data, options.period, options.labelFormat, options.calculateTrend])
}

// Hook for comparison chart data
export function useComparisonData(
  current: Record<string, number> | undefined,
  previous: Record<string, number> | undefined
): {
  chartData: ComparisonData[]
  totalChange: number
  totalChangePercent: number
  isEmpty: boolean
} {
  return useMemo(() => {
    if (!current && !previous) {
      return { chartData: [], totalChange: 0, totalChangePercent: 0, isEmpty: true }
    }
    
    const chartData = generateComparisonData(current || {}, previous || {})
    
    const totalCurrent = chartData.reduce((sum, item) => sum + item.current, 0)
    const totalPrevious = chartData.reduce((sum, item) => sum + item.previous, 0)
    const totalChange = totalCurrent - totalPrevious
    const totalChangePercent = totalPrevious > 0 ? (totalChange / totalPrevious) * 100 : 0
    
    return {
      chartData,
      totalChange,
      totalChangePercent,
      isEmpty: chartData.length === 0
    }
  }, [current, previous])
}

// Hook for multi-series chart data
export interface MultiSeriesData {
  label: string
  data: Array<{ x: string | number; y: number }>
  color?: string
}

export function useMultiSeriesData(
  series: MultiSeriesData[] | undefined,
  options: {
    fillMissing?: boolean
    defaultValue?: number
  } = {}
): {
  chartData: Array<Record<string, string | number | undefined>>
  series: string[]
  isEmpty: boolean
} {
  return useMemo(() => {
    if (!series || series.length === 0) {
      return { chartData: [], series: [], isEmpty: true }
    }
    
    const { fillMissing = false, defaultValue = 0 } = options
    
    // index each series by x for O(1) lookup
    const allXValues = new Set<string | number>()
    const seriesIndexes = series.map(s => {
      const index = new Map<string | number, number>()
      for (const point of s.data) {
        allXValues.add(point.x)
        index.set(point.x, point.y)
      }
      return { label: s.label, index }
    })

    const chartData = Array.from(allXValues).sort().map(x => {
      const dataPoint: Record<string, string | number | undefined> = { x }
      for (const s of seriesIndexes) {
        const y = s.index.get(x)
        dataPoint[s.label] = y !== undefined ? y : (fillMissing ? defaultValue : undefined)
      }
      return dataPoint
    })
    
    const seriesNames = series.map(s => s.label)
    
    return { chartData, series: seriesNames, isEmpty: false }
  }, [series, options.fillMissing, options.defaultValue])
}

// Hook for calculating chart statistics
export function useChartStats(
  data: number[] | undefined
): {
  min: number
  max: number
  avg: number
  median: number
  sum: number
  count: number
} {
  return useMemo(() => {
    if (!data || data.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, sum: 0, count: 0 }
    }
    
    const sorted = [...data].sort((a, b) => a - b)
    const sum = data.reduce((acc, val) => acc + val, 0)
    const avg = sum / data.length
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    
    return {
      min: Math.min(...data),
      max: Math.max(...data),
      avg,
      median,
      sum,
      count: data.length
    }
  }, [data])
}