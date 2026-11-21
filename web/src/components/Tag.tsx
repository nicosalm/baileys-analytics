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

  const Component = onClick ? 'button' : 'span'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-md bg-muted text-foreground whitespace-nowrap max-w-[150px] ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:bg-muted/70' : ''
      } ${selected ? 'ring-2 ring-primary/40' : ''}`}
      onClick={onClick}
    >
      {/* the dot carries the tag's identity color; the text stays in the text color */}
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getTagColor(tag) }} aria-hidden />
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
