import React, { useState, useRef, useEffect } from 'react'
import { Tag } from './Tag'

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
  const [showPopover, setShowPopover] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !containerRef.current?.contains(event.target as Node)
      ) {
        setShowPopover(false)
      }
    }

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

  if (!tags || tags.length === 0) {
    return <span className="text-gray-400 text-xs">No tags</span>
  }

  const visibleTags = tags.slice(0, maxVisible)
  const hiddenCount = tags.length - maxVisible

  const buttonSizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm'

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top

      // Position popover above or below based on available space
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        // Show above
        setPopoverPosition({
          top: rect.top - 10, // Will be adjusted by actual popover height
          left: rect.left
        })
      } else {
        // Show below
        setPopoverPosition({
          top: rect.bottom + 5,
          left: rect.left
        })
      }
    }

    setShowPopover(!showPopover)
  }

  return (
    <>
      <div ref={containerRef} className="flex items-center gap-1 relative">
        {visibleTags.map((tag) => (
          <Tag
            key={tag.id}
            tag={tag}
            size={size}
            onClick={onTagClick ? () => onTagClick(tag) : undefined}
          />
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={handleShowMore}
            className={`inline-flex items-center ${buttonSizeClasses} font-medium rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200`}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>

      {showPopover && hiddenCount > 0 && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 max-w-md"
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            maxHeight: '300px'
          }}
        >
          <div className="text-xs font-medium text-gray-700 mb-2">
            All tags ({tags.length})
          </div>
          <div className="flex flex-wrap gap-1 overflow-y-auto" style={{ maxHeight: '250px' }}>
            {tags.map((tag) => (
              <Tag
                key={tag.id}
                tag={tag}
                size={size}
                onClick={() => {
                  if (onTagClick) {
                    onTagClick(tag)
                  }
                  setShowPopover(false)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
