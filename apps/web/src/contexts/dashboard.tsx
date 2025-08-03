import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { DashboardTab, FilterState, Tag, DateRange } from '@/types/dashboard'

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
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export const useDashboard = () => {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used within DashboardProvider')
  return context
}

const getDefaultDateRange = (): DateRange => ({
  from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0]
})

const initialFilters: FilterState = {
  dateRange: getDefaultDateRange(),
  selectedTags: [],
  selectedProperties: []
}

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('tax')
  const [filters, setFilters] = useState<FilterState>(initialFilters)

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
      clearFilters
    }}>
      {children}
    </DashboardContext.Provider>
  )
}
