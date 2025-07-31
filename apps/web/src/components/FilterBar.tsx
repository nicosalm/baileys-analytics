// apps/web/src/components/FilterBar.tsx
import { useDashboard } from '@/contexts/dashboard'
import { Calendar, Tag as TagIcon, X } from 'lucide-react'
import { useState } from 'react'
import { Tag } from '@/types/dashboard'

// Mock tags for now - these would come from API
const mockTags: Tag[] = [
  { id: '1', name: 'ACH', type: 'payment' },
  { id: '2', name: 'Zelle', type: 'payment' },
  { id: '3', name: 'PayPal', type: 'payment' },
  { id: '4', name: 'Venmo', type: 'payment' },
  { id: '5', name: 'Beachfront', type: 'property' },
  { id: '6', name: 'Pet Friendly', type: 'property' },
  { id: '7', name: 'Hot Tub', type: 'property' }
]

export const FilterBar = () => {
  const { filters, updateDateRange, toggleTag, clearTags } = useDashboard()
  const [showTags, setShowTags] = useState(false)

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
                  {mockTags.map(tag => (
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
                  ))}
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
