import React, { memo } from 'react'
import { SmartPeriodSelector } from './SmartPeriodSelector'
import { useDashboard } from '@/contexts/dashboard'
import { useTags } from '@/hooks/use-api'
import { Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@baileys/utils'
import { getTagColor } from '@/lib/theme'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { Tag } from '@/types/dashboard'

interface TagButtonProps {
  tag: Tag
  isSelected: boolean
  onToggle: (tag: Tag) => void
}

const TagButton = memo(({ tag, isSelected, onToggle }: TagButtonProps) => (
  <Button
    variant="ghost"
    onClick={() => onToggle(tag)}
    className={cn(
      "w-full justify-start px-3 py-2 h-auto text-sm",
      isSelected
        ? "bg-primary/10 text-primary font-medium"
        : "text-foreground"
    )}
  >
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: getTagColor(tag) }}
      />
      <span>{tag.name}</span>
    </div>
  </Button>
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

  const hasActiveFilters = filters.selectedTags.length > 0

  return (
    <div className="bg-background/80 backdrop-blur-sm border-b border-border relative z-30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 md:py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <SmartPeriodSelector
              value={filters.dateRange}
              onChange={updateDateRange}
              comparisonRange={comparisonRange}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "text-sm font-medium text-foreground/80 hover:bg-muted/50 transition-all",
                    filters.selectedTags.length > 0 && "border-primary bg-primary/5"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {filters.selectedTags.length > 0
                      ? `${filters.selectedTags.length} Tag${filters.selectedTags.length > 1 ? 's' : ''}`
                      : 'Tags'
                    }
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="min-w-[200px] max-h-[300px] overflow-y-auto p-2 pr-3">
                {isTagsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading tags...</div>
                ) : availableTags.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No tags available</div>
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
              </PopoverContent>
            </Popover>

            {filters.selectedTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {filters.selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border border-border bg-background text-foreground/80"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getTagColor(tag) }}
                    />
                    {tag.name}
                    <button
                      onClick={() => toggleTag(tag)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
                Clear Tags
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
