// components/FilterBar.tsx
import React, { useState, useEffect, useRef } from 'react'
import { DateRangePicker } from './DateRangePicker'
import { useDashboard } from '@/contexts/dashboard'
import { useTags } from '@/hooks/use-api'
import { Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@baileys/utils'

export const FilterBar: React.FC = () => {
  const {
    filters,
    updateDateRange,
    toggleTag,
    clearFilters
  } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside for tag dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = filters.selectedTags.length > 0

  return (
    <div className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Date Range Picker */}
            <DateRangePicker
              value={filters.dateRange}
              onChange={updateDateRange}
              maxDays={365}
              className="flex-shrink-0"
            />

            {/* Tag Filter Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition-colors",
                  "text-sm font-medium text-gray-700",
                  filters.selectedTags.length > 0 && "border-blue-500 bg-blue-50"
                )}
              >
                <Filter className="w-4 h-4" />
                <span>
                  {filters.selectedTags.length > 0
                    ? `${filters.selectedTags.length} Tag${filters.selectedTags.length > 1 ? 's' : ''}`
                    : 'Filter by Tags'
                  }
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Tag Dropdown Menu */}
              {showTagDropdown && (
                <div className="absolute top-full mt-2 left-0 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[300px] overflow-y-auto z-50">
                  {isTagsLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading tags...</div>
                  ) : availableTags.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No tags available</div>
                  ) : (
                    <div className="space-y-1">
                      {availableTags.map((tag: any) => {
                        const isSelected = filters.selectedTags.some(t => t.id === tag.id)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                              isSelected
                                ? "bg-blue-100 text-blue-700"
                                : "hover:bg-gray-100 text-gray-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span>{tag.name}</span>
                              {tag.color && (
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Tags Display */}
            {filters.selectedTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {filters.selectedTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm"
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={() => toggleTag(tag)}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
