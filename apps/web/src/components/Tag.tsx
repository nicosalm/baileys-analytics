import type React from 'react'
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

export const Tag: React.FC<TagProps> = ({ tag, size = 'sm', onClick, onRemove, selected = false }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  const color = getTagColor(tag)
  const styles = {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: color,
  }

  const Component = onClick ? 'button' : 'span'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`inline-flex items-center rounded-full border whitespace-nowrap max-w-[150px] ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${selected ? 'ring-2 ring-offset-1 ring-info' : ''}`}
      style={styles}
      onClick={onClick}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
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
    </Component>
  )
}
