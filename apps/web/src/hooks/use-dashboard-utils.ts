import { useEffect, useMemo } from 'react'
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
 * Handles error display with consistent toast notifications
 */
export function useErrorToast(error: any, messagePrefix: string = 'Error') {
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
export function useDashboardData<T = any>(
  view: 'overview' | 'financial' | 'properties' | 'occupancy' | 'guests',
  fallbackHook: (params: any) => { data: T; error: any; isLoading: boolean },
  fallbackParams?: any
) {
  const { filters, comparisonRange } = useDashboard()
  const tagIds = useTagIds()
  
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
    comparisonRange?.to
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
  
  return { data, error, isLoading }
}

/**
 * Formats comparison period text consistently
 */
export function formatComparisonText(
  comparisonMode: 'none' | 'previous-period' | 'previous-year',
  _currentValue?: string | number,
  previousValue?: string | number,
  suffix: string = ''
): string {
  if (comparisonMode === 'none' || !previousValue) {
    return suffix
  }
  
  const periodText = comparisonMode === 'previous-year' ? 'last year' : 'previous period'
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
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysDiff <= 7) return ' (Daily)'
  if (daysDiff <= 35) return ' (Weekly)'
  return ' (Monthly)'
}