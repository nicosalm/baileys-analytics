import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { DashboardTab, FilterState, Tag, DateRange } from '@/types/dashboard'
import { formatDateISO, getYear } from '@baileys/utils'
import { isValidDateString, filterValidUUIDs } from '@/utils/validation'

type DashboardContextValue = {
  activeTab: DashboardTab
  setActiveTab: (tab: DashboardTab) => void
  filters: FilterState
  updateDateRange: (range: DateRange) => void
  resetDateRange: () => void
  toggleTag: (tag: Tag) => void
  clearTags: () => void
  toggleProperty: (propertyId: string) => void
  clearFilters: () => void
  getShareableUrl: () => string
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export const useDashboard = () => {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used within DashboardProvider')
  return context
}

const getDefaultDateRange = (): DateRange => ({
  from: formatDateISO(new Date(getYear(new Date()), 0, 1)),
  to: formatDateISO(new Date())
})

const initialFilters: FilterState = {
  dateRange: getDefaultDateRange(),
  selectedTags: [],
  selectedProperties: []
}

// Parse filters from URL params with validation
const parseUrlFilters = (searchParams: URLSearchParams): Partial<FilterState> => {
  const filters: Partial<FilterState> = {}
  const defaultRange = getDefaultDateRange()
  
  // Parse and validate date range
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  if (from || to) {
    const validFrom = from && isValidDateString(from) ? from : defaultRange.from
    const validTo = to && isValidDateString(to) ? to : defaultRange.to
    
    // Ensure from is before to
    if (new Date(validFrom) <= new Date(validTo)) {
      filters.dateRange = {
        from: validFrom,
        to: validTo
      }
    } else {
      // If dates are invalid, use defaults
      filters.dateRange = defaultRange
    }
  }
  
  // Parse and validate selected tags (must be valid UUIDs)
  const tags = searchParams.get('tags')
  if (tags) {
    const tagIds = tags.split(',').filter(Boolean)
    const validTagIds = filterValidUUIDs(tagIds)
    
    // Only create tag objects for valid UUIDs
    filters.selectedTags = validTagIds.map(id => ({ 
      id, 
      name: '', // Will be populated when tags load
      type: 'custom' as const
    }))
  }
  
  // Parse and validate selected properties (must be valid UUIDs)
  const properties = searchParams.get('properties')
  if (properties) {
    const propertyIds = properties.split(',').filter(Boolean)
    filters.selectedProperties = filterValidUUIDs(propertyIds)
  }
  
  return filters
}

// Serialize filters to URL params
const serializeFiltersToUrl = (filters: FilterState, searchParams: URLSearchParams): URLSearchParams => {
  const newParams = new URLSearchParams(searchParams)
  const defaultRange = getDefaultDateRange()
  
  // Date range
  if (filters.dateRange.from !== defaultRange.from) {
    newParams.set('from', filters.dateRange.from)
  } else {
    newParams.delete('from')
  }
  
  if (filters.dateRange.to !== defaultRange.to) {
    newParams.set('to', filters.dateRange.to)
  } else {
    newParams.delete('to')
  }
  
  // Selected tags
  if (filters.selectedTags.length > 0) {
    newParams.set('tags', filters.selectedTags.map(t => t.id).join(','))
  } else {
    newParams.delete('tags')
  }
  
  // Selected properties
  if (filters.selectedProperties.length > 0) {
    newParams.set('properties', filters.selectedProperties.join(','))
  } else {
    newParams.delete('properties')
  }
  
  return newParams
}

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const isInitialMount = useRef(true)
  
  // Parse tab from URL path
  const getActiveTabFromPath = (): DashboardTab => {
    const pathSegments = location.pathname.split('/')
    const tab = pathSegments[pathSegments.length - 1] as DashboardTab
    const validTabs = ['overview', 'financial', 'occupancy', 'properties', 'guests', 'seasonal', 'reports']
    if (tab && validTabs.includes(tab)) {
      return tab
    }
    return 'overview' // Default to overview
  }
  
  const [activeTab, setActiveTab] = useState<DashboardTab>(getActiveTabFromPath)
  
  // Initialize filters from URL on mount
  const getInitialFilters = (): FilterState => {
    const urlFilters = parseUrlFilters(searchParams)
    return {
      ...initialFilters,
      ...urlFilters
    }
  }
  
  const [filters, setFilters] = useState<FilterState>(getInitialFilters)
  
  // Update active tab based on location
  useEffect(() => {
    const newTab = getActiveTabFromPath()
    setActiveTab(newTab)
  }, [location.pathname])
  
  // Sync filters to URL when they change (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    const newParams = serializeFiltersToUrl(filters, searchParams)
    setSearchParams(newParams, { replace: true })
  }, [filters, searchParams, setSearchParams])
  
  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlFilters = parseUrlFilters(new URLSearchParams(window.location.search))
      setFilters(prev => ({
        ...prev,
        ...urlFilters
      }))
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const updateDateRange = useCallback((range: DateRange) => {
    setFilters(prev => ({ ...prev, dateRange: range }))
  }, [])

  const resetDateRange = useCallback(() => {
    setFilters(prev => ({ ...prev, dateRange: getDefaultDateRange() }))
  }, [])

  const toggleTag = useCallback((tag: Tag) => {
    setFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.some(t => t.id === tag.id)
        ? prev.selectedTags.filter(t => t.id !== tag.id)
        : [...prev.selectedTags, tag]
    }))
  }, [])

  const clearTags = useCallback(() => {
    setFilters(prev => ({ ...prev, selectedTags: [] }))
  }, [])

  const toggleProperty = useCallback((propertyId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedProperties: prev.selectedProperties.includes(propertyId)
        ? prev.selectedProperties.filter(id => id !== propertyId)
        : [...prev.selectedProperties, propertyId]
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [])
  
  const getShareableUrl = useCallback(() => {
    const url = new URL(window.location.href)
    url.search = searchParams.toString()
    return url.toString()
  }, [searchParams])

  return (
    <DashboardContext.Provider value={{
      activeTab,
      setActiveTab,
      filters,
      updateDateRange,
      resetDateRange,
      toggleTag,
      clearTags,
      toggleProperty,
      clearFilters,
      getShareableUrl
    }}>
      {children}
    </DashboardContext.Provider>
  )
}