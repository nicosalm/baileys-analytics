import { useEffect, useMemo } from 'react'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'

/**
 * Extracts tag IDs from selected tags with memoization
 */
export function useTagIds() {
  const { filters } = useDashboard()
  return useMemo(() => filters.selectedTags.map((t) => t.id), [filters.selectedTags])
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
      const message = error.message ? `${messagePrefix}: ${error.message}` : `${messagePrefix}: An unexpected error occurred`
      addToast('error', message)
    }
  }, [error?.message, addToast, messagePrefix])
}

/**
 * Computes a short formatted date range string for comparison periods
 */
export function useComparisonDateRange() {
  const { comparisonMode, comparisonRange } = useDashboard()
  return useMemo(() => {
    if (comparisonMode === 'none' || !comparisonRange) return ''
    const fromDate = new Date(`${comparisonRange.from}T00:00:00`)
    const toDate = new Date(`${comparisonRange.to}T00:00:00`)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const fmtYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (fromDate.getFullYear() === toDate.getFullYear()) {
      return `${fmt(fromDate)} \u2013 ${fmt(toDate)}, ${toDate.getFullYear()}`
    }
    return `${fmtYear(fromDate)} \u2013 ${fmtYear(toDate)}`
  }, [comparisonMode, comparisonRange])
}
