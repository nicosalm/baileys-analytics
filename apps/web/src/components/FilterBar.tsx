import { useDashboard } from '@/contexts/dashboard'
import { Calendar, Tag as TagIcon, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Tag } from '@/types/dashboard'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/toast'
import { Spinner } from '@/components/Spinner'

export const FilterBar = () => {
  const { filters, updateDateRange, toggleTag, clearTags } = useDashboard()
  const { addToast } = useToast()
  const [showTags, setShowTags] = useState(false)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  useEffect(() => {
    const loadTags = async () => {
      setLoadingTags(true)
      const result = await api.getTags()

      if (result.success) {
        setAvailableTags(result.data)
      } else {
        addToast('error', 'Failed to load tags')
      }

      setLoadingTags(false)
    }

    loadTags()
  }, [])

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={filters.dateRange.from}
              onChange={(e) => updateDateRange({ ...filters.dateRange, from: e.target.value })}
              className="px-3 py-1 border rounded text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={filters.dateRange.to}
              onChange={(e) => updateDateRange({ ...filters.dateRange, to: e.target.value })}
              className="px-3 py-1 border rounded text-sm"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowTags(!showTags)}
              className="flex items-center px-3 py-1 border rounded text-sm hover:bg-gray-50"
            >
              <TagIcon className="w-4 h-4 mr-2" />
              Tags ({filters.selectedTags.length})
            </button>

            {showTags && (
              <div className="absolute top-full mt-2 left-0 bg-white border rounded shadow-lg p-4 w-64 z-10">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">Filter by Tags</h3>
                  {filters.selectedTags.length > 0 && (
                    <button
                      onClick={clearTags}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {loadingTags ? (
                    <div className="flex justify-center py-4">
                      <Spinner size="sm" />
                    </div>
                  ) : availableTags.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">No tags available</p>
                  ) : (
                    availableTags.map(tag => (
                      <label key={tag.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.selectedTags.some(t => t.id === tag.id)}
                          onChange={() => toggleTag(tag)}
                          className="mr-2"
                        />
                        <span className="text-sm">{tag.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{tag.type}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {filters.selectedTags.length > 0 && (
            <div className="flex items-center space-x-2">
              {filters.selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  {tag.name}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
