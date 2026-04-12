import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { DashboardTab, FilterState, Tag, DateRange } from '@/types/dashboard'
import { formatDateISO, getYear, getMonth } from '@baileys/utils'
import { isValidDateString, filterValidUUIDs } from '@/utils/validation'
import type { Season } from '@/types/season'

type DashboardContextValue = {
  activeTab: DashboardTab
  setActiveTab: (tab: DashboardTab) => void
  filters: FilterState
  comparisonMode: 'none' | 'previous-period' | 'previous-year'
  comparisonRange?: DateRange
  comparisonLabel: string
  updateDateRange: (range: DateRange, comparison?: DateRange, label?: string) => void
  resetDateRange: () => void
  toggleTag: (tag: Tag) => void
  clearTags: () => void
  toggleProperty: (propertyId: string) => void
  applyGroupSelection: (propertyIds: string[], action: 'add' | 'remove') => void
  clearFilters: () => void
  getShareableUrl: () => string
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export const useDashboard = () => {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used within DashboardProvider')
  return context
}

const getDefaultDateRange = (activeSeasons?: Season[]): DateRange => {
  const today = new Date()
  const currentYear = getYear(today)
  const currentMonth = getMonth(today) + 1
  const currentDay = today.getDate()
  
  if (activeSeasons && activeSeasons.length > 0) {
    const season = activeSeasons[0]
    
    const inSeason = season.startMonth <= season.endMonth
      ? (currentMonth > season.startMonth || (currentMonth === season.startMonth && currentDay >= season.startDay)) &&
        (currentMonth < season.endMonth || (currentMonth === season.endMonth && currentDay <= season.endDay))
      : (currentMonth > season.startMonth || (currentMonth === season.startMonth && currentDay >= season.startDay)) ||
        (currentMonth < season.endMonth || (currentMonth === season.endMonth && currentDay <= season.endDay))
    
    const seasonStart = new Date(currentYear, season.startMonth - 1, season.startDay)
    const hasStarted = today >= seasonStart || (season.startMonth > season.endMonth && currentMonth <= season.endMonth)
    
    if (!hasStarted) {
      const startDate = new Date(currentYear - 1, season.startMonth - 1, season.startDay)
      const endDate = season.startMonth <= season.endMonth
        ? new Date(currentYear - 1, season.endMonth - 1, season.endDay)
        : new Date(currentYear, season.endMonth - 1, season.endDay)
      return {
        from: formatDateISO(startDate),
        to: formatDateISO(endDate)
      }
    } else if (inSeason) {
      const startDate = season.startMonth > season.endMonth && currentMonth <= season.endMonth
        ? new Date(currentYear - 1, season.startMonth - 1, season.startDay)
        : new Date(currentYear, season.startMonth - 1, season.startDay)
      return {
        from: formatDateISO(startDate),
        to: formatDateISO(today)
      }
    } else {
      const startDate = new Date(currentYear, season.startMonth - 1, season.startDay)
      const endDate = season.startMonth <= season.endMonth
        ? new Date(currentYear, season.endMonth - 1, season.endDay)
        : new Date(currentYear + 1, season.endMonth - 1, season.endDay)
      return {
        from: formatDateISO(startDate),
        to: formatDateISO(endDate > today ? today : endDate)
      }
    }
  }
  
  return {
    from: formatDateISO(new Date(currentYear, 0, 1)),
    to: formatDateISO(today)
  }
}

const initialFilters: FilterState = {
  dateRange: getDefaultDateRange(),
  selectedTags: [],
  selectedProperties: []
}

const parseUrlFilters = (searchParams: URLSearchParams): Partial<FilterState> => {
  const filters: Partial<FilterState> = {}
  const defaultRange = getDefaultDateRange()
  
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  if (from || to) {
    const validFrom = from && isValidDateString(from) ? from : defaultRange.from
    const validTo = to && isValidDateString(to) ? to : defaultRange.to
    
    if (new Date(validFrom) <= new Date(validTo)) {
      filters.dateRange = {
        from: validFrom,
        to: validTo
      }
    } else {
      filters.dateRange = defaultRange
    }
  }
  
  const tags = searchParams.get('tags')
  if (tags) {
    const tagIds = tags.split(',').filter(Boolean)
    const validTagIds = filterValidUUIDs(tagIds)
    
    filters.selectedTags = validTagIds.map(id => ({ 
      id, 
      name: '',
      type: 'custom' as const
    }))
  }
  
  const properties = searchParams.get('properties')
  if (properties) {
    const propertyIds = properties.split(',').filter(Boolean)
    filters.selectedProperties = filterValidUUIDs(propertyIds)
  }
  
  return filters
}

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
  
  if (filters.selectedTags.length > 0) {
    newParams.set('tags', filters.selectedTags.map(t => t.id).join(','))
  } else {
    newParams.delete('tags')
  }
  
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
  const [comparisonMode, setComparisonMode] = useState<'none' | 'previous-period' | 'previous-year'>('none')
  const [comparisonRange, setComparisonRange] = useState<DateRange | undefined>()
  const [comparisonLabel, setComparisonLabel] = useState('')
  const isInitialMount = useRef(true)
  
  
  const getActiveTabFromPath = (): DashboardTab => {
    const pathSegments = location.pathname.split('/')
    const tab = pathSegments[pathSegments.length - 1] as DashboardTab
    const validTabs = ['overview', 'financial', 'occupancy', 'properties', 'guests']
    if (tab && validTabs.includes(tab)) {
      return tab
    }
    return 'overview'
  }
  
  const [activeTab, setActiveTab] = useState<DashboardTab>(getActiveTabFromPath)
  
  const getInitialFilters = (): FilterState => {
    const urlFilters = parseUrlFilters(searchParams)
    return {
      ...initialFilters,
      ...urlFilters
    }
  }
  
  const [filters, setFilters] = useState<FilterState>(getInitialFilters)
  
  useEffect(() => {
    const newTab = getActiveTabFromPath()
    setActiveTab(newTab)
  }, [location.pathname])
  
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    const newParams = serializeFiltersToUrl(filters, searchParams)
    setSearchParams(newParams, { replace: true })
  }, [filters, searchParams, setSearchParams])
  
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

  const updateDateRange = useCallback((range: DateRange, comparison?: DateRange, label?: string) => {
    setFilters(prev => ({ ...prev, dateRange: range }))
    setComparisonRange(comparison)
    setComparisonLabel(label || '')
    if (!comparison) {
      setComparisonMode('none')
    } else {
      const mainFrom = new Date(range.from)
      const compFrom = new Date(comparison.from)
      const daysDiff = Math.abs((mainFrom.getTime() - compFrom.getTime()) / (1000 * 60 * 60 * 24))

      // detect year-based comparisons (1 year, 2 years, etc.)
      const nearestYearMultiple = Math.round(daysDiff / 365)
      if (nearestYearMultiple >= 1 && Math.abs(daysDiff - nearestYearMultiple * 365) < 65) {
        setComparisonMode('previous-year')
      } else {
        setComparisonMode('previous-period')
      }
    }
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

  const applyGroupSelection = useCallback(
    (propertyIds: string[], action: 'add' | 'remove') => {
      setFilters(prev => {
        const current = new Set(prev.selectedProperties)
        if (action === 'add') {
          propertyIds.forEach(id => current.add(id))
        } else {
          propertyIds.forEach(id => current.delete(id))
        }
        return { ...prev, selectedProperties: Array.from(current) }
      })
    },
    []
  )

  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      selectedTags: [],
      selectedProperties: []
    }))
    setComparisonRange(undefined)
    setComparisonMode('none')
    setComparisonLabel('')
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
      comparisonMode,
      comparisonRange,
      comparisonLabel,
      updateDateRange,
      resetDateRange,
      toggleTag,
      clearTags,
      toggleProperty,
      applyGroupSelection,
      clearFilters,
      getShareableUrl
    }}>
      {children}
    </DashboardContext.Provider>
  )
}