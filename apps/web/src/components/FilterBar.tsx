import React, { useState, useEffect, useRef } from 'react'
import { Tag as TagIcon, X } from 'lucide-react'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Tag } from '@/types/dashboard'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'

// Helper functions
const getTagStyle = (tag: Tag): string => {
  const baseStyle = 'inline-flex items-center px-2 py-1 rounded-full text-xs border cursor-pointer transition-all'

  if (tag.color) {
    return baseStyle
  }

  const typeStyles = {
    payment: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
    guest: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
    booking: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
    property: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200',
    custom: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
  }

  return `${baseStyle} ${typeStyles[tag.type] || typeStyles.custom}`
}

// Tag selector component
interface TagSelectorProps {
  availableTags: Tag[]
  selectedTags: Tag[]
  onToggleTag: (tag: Tag) => void
  onClearTags: () => void
  loading?: boolean
}

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group tags by type
  const tagsByType = availableTags.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = []
    acc[tag.type].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  const typeLabels = {
    property: 'Property Tags',
    booking: 'Booking Tags',
    payment: 'Payment Tags',
    guest: 'Guest Tags',
    custom: 'Other Tags'
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
        disabled={loading}
      >
        <TagIcon className="w-4 h-4 mr-2" />
        Tags ({selectedTags.length})
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white border rounded-lg shadow-lg p-4 w-80 z-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Filter by Tags</h3>
            {selectedTags.length > 0 && (
              <button
                onClick={onClearTags}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              Object.entries(tagsByType).map(([type, tags]) => (
                <div key={type}>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">
                    {typeLabels[type as keyof typeof typeLabels] || type}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const isSelected = selectedTags.some(t => t.id === tag.id)
                      const style = getTagStyle(tag)

                      return tag.color ? (
                        <button
                          key={tag.id}
                          onClick={() => onToggleTag(tag)}
                          className={`${style} ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                          style={{
                            backgroundColor: isSelected ? tag.color : `${tag.color}20`,
                            color: tag.color,
                            borderColor: tag.color
                          }}
                        >
                          {tag.name}
                          {tag.usageCount !== undefined && (
                            <span className="ml-1 opacity-60">({tag.usageCount})</span>
                          )}
                        </button>
                      ) : (
                        <button
                          key={tag.id}
                          onClick={() => onToggleTag(tag)}
                          className={`${style} ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                        >
                          {tag.name}
                          {tag.usageCount !== undefined && (
                            <span className="ml-1 opacity-60">({tag.usageCount})</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Main FilterBar component that integrates with DashboardContext
export const FilterBar: React.FC = () => {
  const {
    activeTab,
    filters,
    updateDateRange,
    toggleTag,
    clearTags
  } = useDashboard()

  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // Load available tags from API
  useEffect(() => {
    const loadTags = async () => {
      setTagsLoading(true)
      try {
        const result = await api.getTags()
        if (result.success) {
          setAvailableTags(result.data)
        }
      } catch (error) {
        console.error('Failed to load tags:', error)
      } finally {
        setTagsLoading(false)
      }
    }
    loadTags()
  }, [])

  // Don't show date range for seasonal tab
  const showDateRange = activeTab !== 'seasonal'

  const removeTag = (tagId: string) => {
    const tag = filters.selectedTags.find(t => t.id === tagId)
    if (tag) {
      toggleTag(tag)
    }
  }

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-4">
          {showDateRange && (
            <DateRangePicker
              value={filters.dateRange}
              onChange={updateDateRange}
              maxDays={730} // 2 years
              debounceMs={500}
            />
          )}

          {availableTags.length > 0 && (
            <div className="flex items-start gap-2 flex-1">
              <TagSelector
                availableTags={availableTags}
                selectedTags={filters.selectedTags}
                onToggleTag={toggleTag}
                onClearTags={clearTags}
                loading={tagsLoading}
              />

              {filters.selectedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {filters.selectedTags.map(tag => {
                    const style = getTagStyle(tag)

                    return tag.color ? (
                      <span
                        key={tag.id}
                        className={`${style} pr-1`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: tag.color
                        }}
                      >
                        {tag.name}
                        <button
                          onClick={() => removeTag(tag.id)}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : (
                      <span key={tag.id} className={`${style} pr-1`}>
                        {tag.name}
                        <button
                          onClick={() => removeTag(tag.id)}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
