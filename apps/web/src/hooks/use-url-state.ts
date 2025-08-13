import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import { formatDateISO } from '@baileys/utils'

interface UrlStateConfig<T> {
  key: string
  defaultValue: T
  serialize?: (value: T) => string
  deserialize?: (value: string) => T
}

// Generic hook for syncing state with URL params
export function useUrlState<T>(config: UrlStateConfig<T>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { key, defaultValue, serialize, deserialize } = config
  
  // Get value from URL or use default
  const getValue = useCallback((): T => {
    const urlValue = searchParams.get(key)
    if (urlValue === null) return defaultValue
    
    try {
      return deserialize ? deserialize(urlValue) : (urlValue as unknown as T)
    } catch {
      return defaultValue
    }
  }, [searchParams, key, defaultValue, deserialize])
  
  // Set value in URL
  const setValue = useCallback((value: T) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      
      if (value === defaultValue || value === null || value === undefined) {
        // Remove param if it's the default value
        newParams.delete(key)
      } else {
        const serialized = serialize ? serialize(value) : String(value)
        newParams.set(key, serialized)
      }
      
      return newParams
    }, { replace: true }) // Use replace to avoid polluting history on every filter change
  }, [key, defaultValue, serialize, setSearchParams])
  
  return [getValue(), setValue] as const
}

// Specialized hook for date range in URL
export function useUrlDateRange(defaultFrom?: string, defaultTo?: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  
  const getDateRange = useCallback(() => {
    const from = searchParams.get('from') || defaultFrom || formatDateISO(new Date(new Date().getFullYear(), 0, 1))
    const to = searchParams.get('to') || defaultTo || formatDateISO(new Date())
    return { from, to }
  }, [searchParams, defaultFrom, defaultTo])
  
  const setDateRange = useCallback((from: string, to: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      
      // Only set if different from defaults
      const defaultFromDate = defaultFrom || formatDateISO(new Date(new Date().getFullYear(), 0, 1))
      const defaultToDate = defaultTo || formatDateISO(new Date())
      
      if (from === defaultFromDate) {
        newParams.delete('from')
      } else {
        newParams.set('from', from)
      }
      
      if (to === defaultToDate) {
        newParams.delete('to')
      } else {
        newParams.set('to', to)
      }
      
      return newParams
    }, { replace: true })
  }, [defaultFrom, defaultTo, setSearchParams])
  
  return { dateRange: getDateRange(), setDateRange }
}

// Hook for managing array values in URL (like selected tags/properties)
export function useUrlArray(key: string, defaultValue: string[] = []) {
  return useUrlState({
    key,
    defaultValue,
    serialize: (value: string[]) => value.length > 0 ? value.join(',') : '',
    deserialize: (value: string) => value ? value.split(',').filter(Boolean) : []
  })
}

// Hook to sync all dashboard filters with URL
export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  const getFilters = useCallback(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const tags = searchParams.get('tags')
    const properties = searchParams.get('properties')
    const view = searchParams.get('view')
    
    return {
      dateRange: {
        from: from || formatDateISO(new Date(new Date().getFullYear(), 0, 1)),
        to: to || formatDateISO(new Date())
      },
      tagIds: tags ? tags.split(',').filter(Boolean) : [],
      propertyIds: properties ? properties.split(',').filter(Boolean) : [],
      view: view || 'overview'
    }
  }, [searchParams])
  
  const updateFilters = useCallback((updates: {
    dateRange?: { from: string; to: string }
    tagIds?: string[]
    propertyIds?: string[]
    view?: string
  }) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      
      // Update date range
      if (updates.dateRange) {
        const defaultFrom = formatDateISO(new Date(new Date().getFullYear(), 0, 1))
        const defaultTo = formatDateISO(new Date())
        
        if (updates.dateRange.from === defaultFrom) {
          newParams.delete('from')
        } else {
          newParams.set('from', updates.dateRange.from)
        }
        
        if (updates.dateRange.to === defaultTo) {
          newParams.delete('to')
        } else {
          newParams.set('to', updates.dateRange.to)
        }
      }
      
      // Update tags
      if (updates.tagIds !== undefined) {
        if (updates.tagIds.length > 0) {
          newParams.set('tags', updates.tagIds.join(','))
        } else {
          newParams.delete('tags')
        }
      }
      
      // Update properties
      if (updates.propertyIds !== undefined) {
        if (updates.propertyIds.length > 0) {
          newParams.set('properties', updates.propertyIds.join(','))
        } else {
          newParams.delete('properties')
        }
      }
      
      // Update view
      if (updates.view !== undefined) {
        if (updates.view === 'overview') {
          newParams.delete('view')
        } else {
          newParams.set('view', updates.view)
        }
      }
      
      return newParams
    }, { replace: true })
  }, [setSearchParams])
  
  return { filters: getFilters(), updateFilters }
}

// Hook to get shareable URL
export function useShareableUrl() {
  const [searchParams] = useSearchParams()
  
  const getShareableUrl = useCallback(() => {
    const url = new URL(window.location.href)
    url.search = searchParams.toString()
    return url.toString()
  }, [searchParams])
  
  return getShareableUrl()
}