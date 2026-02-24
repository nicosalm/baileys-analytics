import React from 'react'
import { getTagColor } from '@/lib/theme'

interface TagProps {
  tag: {
    id: string
    name: string
    color?: string
  }
  size?: 'sm' | 'md'
  onClick?: () => void
  onRemove?: () => void
  selected?: boolean
}

export const Tag: React.FC<TagProps> = ({
  tag,
  size = 'sm',
  onClick,
  onRemove,
  selected = false
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  const color = getTagColor(tag)
  const styles = {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: color
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
      style={styles}
      onClick={onClick}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 hover:opacity-70 cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}

interface TagListProps {
  tags: Array<{
    id: string
    name: string
    color?: string
  }>
  size?: 'sm' | 'md'
  maxDisplay?: number
  onTagClick?: (tag: TagListProps['tags'][0]) => void
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  size = 'sm',
  maxDisplay = 3,
  onTagClick
}) => {
  if (tags.length === 0) return null

  const displayTags = tags.slice(0, maxDisplay)
  const remainingCount = tags.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map(tag => (
        <Tag
          key={tag.id}
          tag={tag}
          size={size}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
      {remainingCount > 0 && (
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-500`}>
          +{remainingCount}
        </span>
      )}
    </div>
  )
}
