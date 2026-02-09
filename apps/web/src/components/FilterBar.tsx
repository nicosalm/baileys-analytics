import React, { useState, useEffect, useRef, memo } from 'react'
import { SmartPeriodSelector } from './SmartPeriodSelector'
import { useDashboard } from '@/contexts/dashboard'
import { useTags } from '@/hooks/use-api'
import { Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@baileys/utils'
import type { Tag } from '@/types/dashboard'

interface TagButtonProps {
  tag: Tag
  isSelected: boolean
  onToggle: (tag: Tag) => void
}

const TagButton = memo(({ tag, isSelected, onToggle }: TagButtonProps) => (
  <button
    onClick={() => onToggle(tag)}
    className={cn(
      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
      isSelected
        ? "bg-blue-50 text-blue-700 font-medium"
        : "hover:bg-gray-50 text-gray-700"
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
))

TagButton.displayName = 'TagButton'

export const FilterBar: React.FC = () => {
  const {
    filters,
    comparisonRange,
    updateDateRange,
    toggleTag,
    clearFilters
  } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 relative z-30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 md:py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <SmartPeriodSelector
              value={filters.dateRange}
              onChange={updateDateRange}
              comparisonRange={comparisonRange}
            />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 md:px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition-all cursor-pointer",
                  "text-sm font-medium text-gray-700",
                  showTagDropdown && "ring-2 ring-blue-600 border-blue-600",
                  filters.selectedTags.length > 0 && "border-blue-600 bg-blue-50/50"
                )}
              >
                <Filter className="w-4 h-4" />
                <span>
                  {filters.selectedTags.length > 0
                    ? `${filters.selectedTags.length} Tag${filters.selectedTags.length > 1 ? 's' : ''}`
                    : 'Tags'
                  }
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showTagDropdown && "rotate-180"
                )} />
              </button>

              {showTagDropdown && (
                <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[300px] overflow-y-auto z-40">
                  {isTagsLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading tags...</div>
                  ) : availableTags.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No tags available</div>
                  ) : (
                    <div className="space-y-1">
                      {availableTags.map((tag: any) => (
                        <TagButton
                          key={tag.id}
                          tag={tag}
                          isSelected={filters.selectedTags.some(t => t.id === tag.id)}
                          onToggle={toggleTag}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {filters.selectedTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {filters.selectedTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium"
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={() => toggleTag(tag)}
                      className="hover:bg-blue-100 rounded-md p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                Clear Tags
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
