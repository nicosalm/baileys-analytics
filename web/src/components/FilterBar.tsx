import type React from 'react'
import { memo, useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { SmartPeriodSelector } from './SmartPeriodSelector'
import { useDashboard } from '@/contexts/dashboard'
import { useTags, useProperties, usePropertyGroups } from '@/hooks/use-api'
import type { PropertyGroup } from '@/hooks/use-api'
import { Tag as TagIcon, X, Check, Minus, ChevronDown, Home } from 'lucide-react'
import { getTagColor } from '@/lib/theme'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { menuStyles } from '@/components/ui/menu-styles'
import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/types/dashboard'

// visual check box for multi-select rows; the row itself is the button
const SelectBox = ({ state }: { state: 'all' | 'partial' | 'none' }) => (
  <span
    aria-hidden
    className={cn(
      'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
      state === 'none' ? 'border-input' : 'border-primary bg-primary text-primary-foreground',
    )}
  >
    {state === 'all' && <Check className="size-3" />}
    {state === 'partial' && <Minus className="size-3" />}
  </span>
)

interface TagButtonProps {
  tag: Tag
  isSelected: boolean
  onToggle: (tag: Tag) => void
}

const TagButton = memo(({ tag, isSelected, onToggle }: TagButtonProps) => (
  <button type="button" aria-pressed={isSelected} onClick={() => onToggle(tag)} className={menuStyles.item}>
    <SelectBox state={isSelected ? 'all' : 'none'} />
    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getTagColor(tag) }} />
    <span className="truncate">{tag.name}</span>
  </button>
))

TagButton.displayName = 'TagButton'

interface PropertyButtonProps {
  property: { id: string; name: string }
  isSelected: boolean
  onToggle: (propertyId: string) => void
}

const PropertyButton = memo(({ property, isSelected, onToggle }: PropertyButtonProps) => (
  <button type="button" aria-pressed={isSelected} onClick={() => onToggle(property.id)} className={menuStyles.item}>
    <SelectBox state={isSelected ? 'all' : 'none'} />
    <span className="truncate">{property.name}</span>
  </button>
))

PropertyButton.displayName = 'PropertyButton'

type GroupSelectionState = 'all' | 'partial' | 'none'

interface GroupButtonProps {
  group: PropertyGroup
  selectionState: GroupSelectionState
  selectedCount: number
  onToggle: () => void
  onHoverStart: () => void
  onHoverEnd: () => void
}

const GroupButton = memo(({ group, selectionState, selectedCount, onToggle, onHoverStart, onHoverEnd }: GroupButtonProps) => (
  <button
    type="button"
    onClick={onToggle}
    onMouseEnter={onHoverStart}
    onMouseLeave={onHoverEnd}
    aria-pressed={selectionState === 'all' ? true : selectionState === 'partial' ? 'mixed' : false}
    className={menuStyles.item}
  >
    <SelectBox state={selectionState} />
    <span className="flex-1 text-left truncate">{group.name}</span>
    <span className="text-xs text-muted-foreground tabular-nums">
      {selectedCount}/{group.propertyIds.length}
    </span>
  </button>
))

GroupButton.displayName = 'GroupButton'

const ActiveFilterPills: React.FC<{
  filters: ReturnType<typeof useDashboard>['filters']
  availableProperties: Array<{ id: string; name: string }>
  toggleTag: (tag: Tag) => void
  toggleProperty: (id: string) => void
  clearFilters: () => void
}> = ({ filters, availableProperties, toggleTag, toggleProperty, clearFilters }) => {
  const hasActiveFilters = filters.selectedTags.length > 0 || filters.selectedProperties.length > 0
  const propertyById = useMemo(() => new Map(availableProperties.map((p) => [p.id, p])), [availableProperties])
  if (!hasActiveFilters) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.selectedProperties.map((propertyId) => {
        const property = propertyById.get(propertyId)
        return (
          <span
            key={propertyId}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-md border border-primary/20 bg-primary/5 text-foreground"
          >
            <Home className="w-3 h-3 flex-shrink-0 text-primary/60" />
            {property?.name || 'Unknown'}
            <button
              type="button"
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
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getTagColor(tag) }} />
          {tag.name}
          <button
            type="button"
            onClick={() => toggleTag(tag)}
            aria-label={`Remove ${tag.name} filter`}
            className="ml-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
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
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(menuStyles.item, 'justify-between font-medium')}
      >
        <span className="flex items-center gap-2">
          {label}
          {count !== undefined && count > 0 && (
            <Badge variant="info" className="tabular-nums">
              {count}
            </Badge>
          )}
        </span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

export const MobileFilterControls: React.FC = () => {
  const { filters, toggleTag, toggleProperty, clearFilters } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const { data: availableProperties = [], isLoading: isPropertiesLoading } = useProperties()
  const mobileSelectedSet = useMemo(() => new Set(filters.selectedProperties), [filters.selectedProperties])
  const hasActiveFilters = filters.selectedTags.length > 0 || filters.selectedProperties.length > 0

  return (
    <div className="space-y-3">
      <CollapsibleFilterSection label="Properties" count={filters.selectedProperties.length}>
        {isPropertiesLoading ? (
          <p className="text-sm text-muted-foreground px-1">Loading...</p>
        ) : availableProperties.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No properties</p>
        ) : (
          <div className="space-y-0.5">
            {availableProperties.map((property) => (
              <PropertyButton
                key={property.id}
                property={property}
                isSelected={mobileSelectedSet.has(property.id)}
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
              <TagButton key={tag.id} tag={tag} isSelected={filters.selectedTags.some((t) => t.id === tag.id)} onToggle={toggleTag} />
            ))}
          </div>
        )}
      </CollapsibleFilterSection>

      {hasActiveFilters && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">Active</span>
            <button
              type="button"
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
  const { filters, comparisonRange, updateDateRange, toggleTag, toggleProperty, applyGroupSelection, clearFilters } = useDashboard()

  const { data: availableTags = [], isLoading: isTagsLoading } = useTags()
  const { data: availableProperties = [], isLoading: isPropertiesLoading } = useProperties()
  const { data: availableGroups = [] } = usePropertyGroups()

  const [tagsOpen, setTagsOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)

  const selectedPropertySet = useMemo(() => new Set(filters.selectedProperties), [filters.selectedProperties])

  const hoveredGroup = useMemo(
    () => (hoveredGroupId ? availableGroups.find((g) => g.id === hoveredGroupId) : null),
    [hoveredGroupId, availableGroups],
  )

  const hoveredPropertySet = useMemo(() => (hoveredGroup ? new Set(hoveredGroup.propertyIds) : null), [hoveredGroup])

  const groupSelections = useMemo(() => {
    const selected = new Set(filters.selectedProperties)
    return availableGroups.map((group) => {
      const count = group.propertyIds.filter((id) => selected.has(id)).length
      const state: GroupSelectionState = count === 0 ? 'none' : count === group.propertyIds.length ? 'all' : 'partial'
      return { groupId: group.id, state, count }
    })
  }, [availableGroups, filters.selectedProperties])

  const hasGroups = availableGroups.length > 0

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
    <div className="bg-background/80 backdrop-blur-sm border-b border-border relative z-30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 md:py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex w-full items-center gap-2 md:w-auto md:flex-wrap">
            {/* properties and tags live in the menu sheet below md */}
            <SmartPeriodSelector
              value={filters.dateRange}
              onChange={updateDateRange}
              comparisonRange={comparisonRange}
              className="min-w-0 flex-1 md:flex-none"
            />

            <Popover
              open={propertiesOpen}
              onOpenChange={(open) => {
                setPropertiesOpen(open)
                if (!open) setHoveredGroupId(null)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'hidden md:inline-flex text-sm font-medium',
                    filters.selectedProperties.length > 0 && 'border-primary/40 bg-primary/5',
                    propertiesOpen && 'bg-muted/50',
                  )}
                >
                  <Home className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {filters.selectedProperties.length > 0
                      ? `${filters.selectedProperties.length} propert${filters.selectedProperties.length > 1 ? 'ies' : 'y'}`
                      : 'Properties'}
                  </span>
                  <ChevronDown
                    className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', propertiesOpen && 'rotate-180')}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className={hasGroups ? 'w-[460px] p-0' : 'w-64 max-h-80 overflow-y-auto p-1'}>
                {isPropertiesLoading ? (
                  <div className={cn('text-center py-4 text-muted-foreground', hasGroups && 'p-2')}>Loading properties...</div>
                ) : availableProperties.length === 0 ? (
                  <div className={cn('text-center py-4 text-muted-foreground', hasGroups && 'p-2')}>No properties</div>
                ) : hasGroups ? (
                  <div className="flex divide-x divide-border">
                    <div className="w-[45%] p-1 overflow-y-auto max-h-80">
                      <div className={menuStyles.label}>Groups</div>
                      <div className="space-y-0.5">
                        {availableGroups.map((group) => {
                          const sel = groupSelections.find((s) => s.groupId === group.id)
                          return (
                            <GroupButton
                              key={group.id}
                              group={group}
                              selectionState={sel?.state || 'none'}
                              selectedCount={sel?.count || 0}
                              onToggle={() => {
                                const action = sel?.state === 'all' ? 'remove' : 'add'
                                applyGroupSelection(group.propertyIds, action)
                              }}
                              onHoverStart={() => setHoveredGroupId(group.id)}
                              onHoverEnd={() => setHoveredGroupId(null)}
                            />
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex-1 p-1 overflow-y-auto max-h-80">
                      <div className={menuStyles.label}>Properties</div>
                      <div className="space-y-0.5">
                        {availableProperties.map((property) => (
                          <div
                            key={property.id}
                            className={cn(
                              'transition-opacity duration-150',
                              hoveredPropertySet && !hoveredPropertySet.has(property.id) ? 'opacity-30' : 'opacity-100',
                            )}
                          >
                            <PropertyButton
                              property={property}
                              isSelected={selectedPropertySet.has(property.id)}
                              onToggle={toggleProperty}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {availableProperties.map((property) => (
                      <PropertyButton
                        key={property.id}
                        property={property}
                        isSelected={selectedPropertySet.has(property.id)}
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
                    'hidden md:inline-flex text-sm font-medium',
                    filters.selectedTags.length > 0 && 'border-primary/40 bg-primary/5',
                    tagsOpen && 'bg-muted/50',
                  )}
                >
                  <TagIcon className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {filters.selectedTags.length > 0
                      ? `${filters.selectedTags.length} tag${filters.selectedTags.length > 1 ? 's' : ''}`
                      : 'Tags'}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', tagsOpen && 'rotate-180')} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 max-h-80 overflow-y-auto p-1">
                {isTagsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : availableTags.length === 0 ? (
                  <div className="py-3 px-2 space-y-1 text-sm">
                    <p className="text-muted-foreground">No tags. Tags sync from OwnerRez.</p>
                    <Link to="/docs/ownerrez-data#tagging" className="text-primary underline-offset-2 hover:underline">
                      Tagging in OwnerRez
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {availableTags.map((tag) => (
                      <TagButton
                        key={tag.id}
                        tag={tag}
                        isSelected={filters.selectedTags.some((t) => t.id === tag.id)}
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
