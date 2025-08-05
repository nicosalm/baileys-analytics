import React, { useState, useEffect, useRef } from 'react'
import { Tag as TagIcon } from 'lucide-react'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Tag } from '@/components/Tag'
import { Tag as TagType } from '@/types/dashboard'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'

interface TagSelectorProps {
  availableTags: TagType[]
  selectedTags: TagType[]
  onToggleTag: (tag: TagType) => void
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const tagsByType = availableTags.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = []
    acc[tag.type].push(tag)
    return acc
  }, {} as Record<string, TagType[]>)

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
                      return (
                        <span key={tag.id} className="inline-flex items-center">
                          <Tag
                            tag={tag}
                            onClick={() => onToggleTag(tag)}
                            selected={isSelected}
                          />
                          {tag.usageCount !== undefined && (
                            <span className="ml-1 text-xs opacity-60">({tag.usageCount})</span>
                          )}
                        </span>
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

export const FilterBar: React.FC = () => {
  const {
    activeTab,
    filters,
    updateDateRange,
    toggleTag,
    clearTags
  } = useDashboard()

  const [availableTags, setAvailableTags] = useState<TagType[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

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
              maxDays={730}
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
                  {filters.selectedTags.map(tag => (
                    <Tag
                      key={tag.id}
                      tag={tag}
                      onRemove={() => removeTag(tag.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
