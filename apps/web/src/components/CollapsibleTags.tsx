import React from 'react'
import { Tag } from './Tag'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface CollapsibleTagsProps {
  tags: Array<{
    id: string
    name: string
    color?: string
  }>
  maxVisible?: number
  size?: 'sm' | 'md'
  onTagClick?: (tag: CollapsibleTagsProps['tags'][0]) => void
}

export const CollapsibleTags: React.FC<CollapsibleTagsProps> = ({
  tags,
  maxVisible = 2,
  size = 'sm',
  onTagClick
}) => {
  if (!tags || tags.length === 0) {
    return <span className="text-gray-400 text-xs">No tags</span>
  }

  const visibleTags = tags.slice(0, maxVisible)
  const hiddenCount = tags.length - maxVisible

  const buttonSizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm'

  return (
    <div className="flex items-center gap-1 relative">
      {visibleTags.map((tag) => (
        <Tag
          key={tag.id}
          tag={tag}
          size={size}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}

      {hiddenCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center ${buttonSizeClasses} font-medium rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer`}
            >
              +{hiddenCount} more
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-md p-3">
            <div className="text-xs font-medium text-gray-700 mb-2">
              All tags ({tags.length})
            </div>
            <div className="flex flex-wrap gap-1 overflow-y-auto" style={{ maxHeight: '250px' }}>
              {tags.map((tag) => (
                <Tag
                  key={tag.id}
                  tag={tag}
                  size={size}
                  onClick={onTagClick ? () => onTagClick(tag) : undefined}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
