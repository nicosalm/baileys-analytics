import { useEffect, useMemo } from 'react'
import { MS_PER_DAY } from '@baileys/constants'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from './use-api'

/**
 * Extracts tag IDs from selected tags with memoization
 */
export function useTagIds() {
  const { filters } = useDashboard()
  return useMemo(() => filters.selectedTags.map(t => t.id), [filters.selectedTags])
}

/**
 * Extracts selected property IDs with memoization
 */
export function usePropertyIds() {
  const { filters } = useDashboard()
  return useMemo(() => filters.selectedProperties, [filters.selectedProperties])
}

/**
 * Handles error display with consistent toast notifications
 */
export function useErrorToast(error: Error | undefined, messagePrefix: string = 'Error') {
  const { addToast } = useToast()
  
  useEffect(() => {
    if (error) {
      const message = error.message 
        ? `${messagePrefix}: ${error.message}` 
        : `${messagePrefix}: An unexpected error occurred`
      addToast('error', message)
    }
  }, [error?.message, addToast, messagePrefix])
}

/**
 * Consolidated hook for fetching dashboard data with batch endpoint and fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dashboard batch returns view-specific shapes
export function useDashboardData<T = Record<string, any>>(
  view: 'overview' | 'financial' | 'properties' | 'occupancy' | 'guests',
  fallbackHook: (params: unknown) => { data: T; error: Error | undefined; isLoading: boolean },
  fallbackParams?: unknown
) {
  const { filters, comparisonRange } = useDashboard()
  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()

  // Use batch endpoint
  const {
    data: batchData,
    error: batchError,
    isLoading: batchLoading
  } = useDashboardBatch(
    view,
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds
  )
  
  // Fallback to old endpoint if batch fails
  const shouldUseFallback = !batchData && !batchLoading
  const { 
    data: oldData, 
    error: oldError, 
    isLoading: oldLoading 
  } = fallbackHook(shouldUseFallback ? fallbackParams : undefined)
  
  // Combine results
  const data = batchData || oldData
  const error = batchError || oldError
  const isLoading = batchLoading || (!batchData && oldLoading)
  const isValidating = !!(batchData ? false : !batchLoading)

  return {
    data,
    error: (!data && isValidating) ? undefined : error,
    isLoading: isLoading || (!data && !error),
  }
}

/**
 * Computes a short formatted date range string for comparison periods
 */
export function useComparisonDateRange() {
  const { comparisonMode, comparisonRange } = useDashboard()
  return useMemo(() => {
    if (comparisonMode === 'none' || !comparisonRange) return ''
    const fromDate = new Date(comparisonRange.from + 'T00:00:00')
    const toDate = new Date(comparisonRange.to + 'T00:00:00')
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const fmtYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (fromDate.getFullYear() === toDate.getFullYear()) {
      return `${fmt(fromDate)} \u2013 ${fmt(toDate)}, ${toDate.getFullYear()}`
    }
    return `${fmtYear(fromDate)} \u2013 ${fmtYear(toDate)}`
  }, [comparisonMode, comparisonRange])
}

/**
 * Formats comparison period text consistently
 */
export function formatComparisonText(
  comparisonMode: 'none' | 'previous-period' | 'previous-year',
  _currentValue?: string | number,
  previousValue?: string | number,
  suffix: string = '',
  comparisonLabel?: string
): string {
  if (comparisonMode === 'none' || !previousValue) {
    return suffix
  }

  const periodText = comparisonLabel || (comparisonMode === 'previous-year' ? 'last year' : 'previous period')
  const formattedPrevious = typeof previousValue === 'number'
    ? previousValue.toLocaleString()
    : previousValue

  return `vs ${periodText}: ${formattedPrevious}${suffix ? ' | ' + suffix : ''}`
}

/**
 * Calculates growth percentage with null safety
 */
export function calculateGrowth(current: number, previous?: number): number | undefined {
  if (!previous || previous === 0) return undefined
  return ((current - previous) / previous) * 100
}

/**
 * Determines time period granularity based on date range
 */
export function getTimePeriodGranularity(from?: string, to?: string): string {
  if (!from || !to) return ''
  
  const startDate = new Date(from)
  const endDate = new Date(to)
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY)
  
  if (daysDiff <= 7) return ' (Daily)'
  if (daysDiff <= 35) return ' (Weekly)'
  return ' (Monthly)'
}