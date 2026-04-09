import React, { memo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SmartPeriodSelector } from './SmartPeriodSelector'
import { useDashboard } from '@/contexts/dashboard'
import { useTags, useProperties } from '@/hooks/use-api'
import { Filter, X, ChevronDown, ChevronRight, Home } from 'lucide-react'
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

interface PropertyButtonProps {
  property: { id: string; name: string }
  isSelected: boolean
  onToggle: (propertyId: string) => void
}

const PropertyButton = memo(({ property, isSelected, onToggle }: PropertyButtonProps) => (
  <Button
    variant="ghost"
    onClick={() => onToggle(property.id)}
    className={cn(
      "w-full justify-start px-3 py-2 h-auto text-sm",
      isSelected
        ? "bg-primary/10 text-primary font-medium"
        : "text-foreground"
    )}
  >
    <div className="flex items-center gap-2">
      <Home className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
      <span>{property.name}</span>
    </div>
  </Button>
))

PropertyButton.displayName = 'PropertyButton'

const ActiveFilterPills: React.FC<{
  filters: ReturnType<typeof useDashboard>['filters']
  availableProperties: Array<{ id: string; name: string }>
  toggleTag: (tag: Tag) => void
  toggleProperty: (id: string) => void
  clearFilters: () => void
}> = ({ filters, availableProperties, toggleTag, toggleProperty, clearFilters }) => {
  const hasActiveFilters = filters.selectedTags.length > 0 || filters.selectedProperties.length > 0
  if (!hasActiveFilters) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.selectedProperties.map((propertyId) => {
        const property = availableProperties.find((p) => p.id === propertyId)
        return (
          <span
            key={propertyId}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-md border border-primary/20 bg-primary/5 text-foreground"
          >
            <Home className="w-3 h-3 flex-shrink-0 text-primary/60" />
            {property?.name || 'Unknown'}
            <button
              onClick={() => toggleProperty(propertyId)}
              aria-label={`Remove ${property?.name || 'property'} filter`}
              className="ml-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}
      {filters.selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-md border border-primary/20 bg-primary/5 text-foreground"
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getTagColor(tag) }}
          />
          {tag.name}
          <button
            onClick={() => toggleTag(tag)}
            aria-label={`Remove ${tag.name} filter`}
            className="ml-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={clearFilters}
        aria-label="Clear all filters"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        Clear all
      </button>
    </div>
  )
}

const CollapsibleFilterSection: React.FC<{
  label: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}> = ({ label, count, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-1 py-1.5 cursor-pointer"
      >
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {label}
          {count !== undefined && count > 0 && (
            <span className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
              {count}
            </span>
          )}
        </span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

export const MobileFilterControls: React.FC = () => {
  const {
    filters,
    comparisonRange,
    updateDateRange,
    toggleTag,
    toggleProperty,
    clearFilters
  } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const { data: availableProperties = [], isLoading: isPropertiesLoading } = useProperties()
  const hasActiveFilters = filters.selectedTags.length > 0 || filters.selectedProperties.length > 0

  return (
    <div className="space-y-3">
      <div>
        <SmartPeriodSelector
          value={filters.dateRange}
          onChange={updateDateRange}
          comparisonRange={comparisonRange}
          className="w-full"
        />
      </div>

      <CollapsibleFilterSection label="Properties" count={filters.selectedProperties.length}>
        {isPropertiesLoading ? (
          <p className="text-sm text-muted-foreground px-1">Loading...</p>
        ) : availableProperties.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No properties available</p>
        ) : (
          <div className="space-y-0.5">
            {availableProperties.map((property) => (
              <PropertyButton
                key={property.id}
                property={property}
                isSelected={filters.selectedProperties.includes(property.id)}
                onToggle={toggleProperty}
              />
            ))}
          </div>
        )}
      </CollapsibleFilterSection>

      <CollapsibleFilterSection label="Tags" count={filters.selectedTags.length}>
        {isTagsLoading ? (
          <p className="text-sm text-muted-foreground px-1">Loading...</p>
        ) : availableTags.length === 0 ? (
          <div className="px-1 space-y-1">
            <p className="text-sm text-muted-foreground">No tags found.</p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Tags are imported from OwnerRez.{' '}
              <Link to="/docs/ownerrez-data#tagging" className="text-primary hover:text-primary/80 underline-offset-2 hover:underline">
                See how tagging works
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {availableTags.map((tag) => (
              <TagButton
                key={tag.id}
                tag={tag}
                isSelected={filters.selectedTags.some(t => t.id === tag.id)}
                onToggle={toggleTag}
              />
            ))}
          </div>
        )}
      </CollapsibleFilterSection>

      {hasActiveFilters && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</span>
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>
          <ActiveFilterPills
            filters={filters}
            availableProperties={availableProperties}
            toggleTag={toggleTag}
            toggleProperty={toggleProperty}
            clearFilters={clearFilters}
          />
        </div>
      )}
    </div>
  )
}

export const FilterBar: React.FC = () => {
  const {
    filters,
    comparisonRange,
    updateDateRange,
    toggleTag,
    toggleProperty,
    clearFilters
  } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const { data: availableProperties = [], isLoading: isPropertiesLoading } = useProperties()

  const [tagsOpen, setTagsOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)

  // close popovers on scroll to prevent overlap with sticky header
  useEffect(() => {
    if (!tagsOpen && !propertiesOpen) return
    const onScroll = () => {
      setTagsOpen(false)
      setPropertiesOpen(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [tagsOpen, propertiesOpen])

  return (
    <div className="hidden sm:block bg-background/80 backdrop-blur-sm border-b border-border relative z-30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 md:py-3 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <SmartPeriodSelector
              value={filters.dateRange}
              onChange={updateDateRange}
              comparisonRange={comparisonRange}
            />

            <Popover open={propertiesOpen} onOpenChange={setPropertiesOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "text-sm font-medium text-foreground/80 hover:bg-muted/50 transition-all",
                    filters.selectedProperties.length > 0 && "border-primary bg-primary/5"
                  )}
                >
                  <Home className="w-4 h-4" />
                  <span>
                    {filters.selectedProperties.length > 0
                      ? `${filters.selectedProperties.length} Propert${filters.selectedProperties.length > 1 ? 'ies' : 'y'}`
                      : 'Properties'
                    }
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="min-w-[200px] max-h-[300px] overflow-y-auto p-2 pr-3">
                {isPropertiesLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading properties...</div>
                ) : availableProperties.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No properties available</div>
                ) : (
                  <div className="space-y-1">
                    {availableProperties.map((property) => (
                      <PropertyButton
                        key={property.id}
                        property={property}
                        isSelected={filters.selectedProperties.includes(property.id)}
                        onToggle={toggleProperty}
                      />
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
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
                  <div className="py-4 px-3 space-y-1 text-center">
                    <p className="text-sm text-muted-foreground">No tags found.</p>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      Tags are imported from OwnerRez.{' '}
                      <Link to="/docs/ownerrez-data#tagging" className="text-primary hover:text-primary/80 underline-offset-2 hover:underline">
                        See how tagging works
                      </Link>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {availableTags.map((tag) => (
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
          </div>
        </div>

        <ActiveFilterPills
          filters={filters}
          availableProperties={availableProperties}
          toggleTag={toggleTag}
          toggleProperty={toggleProperty}
          clearFilters={clearFilters}
        />
      </div>
    </div>
  )
}
