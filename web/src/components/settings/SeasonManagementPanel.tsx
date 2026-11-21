import type React from 'react'
import { useState } from 'react'
import { useSeasons, createSeason, updateSeason, deleteSeason, toggleSeasonActive } from '@/hooks/use-api'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Season, SeasonFormData } from '@/types/season'
import { Badge } from '@/components/ui/badge'
import { SettingsSection, SettingsError } from './SettingsSection'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(month: number): number {
  // seasons recur yearly, so use a non-leap year
  return new Date(2001, month, 0).getDate()
}

const SeasonForm: React.FC<{
  initialData?: SeasonFormData
  onSubmit: (data: SeasonFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}> = ({ initialData, onSubmit, onCancel, isEditing = false }) => {
  const [formData, setFormData] = useState<SeasonFormData>(
    initialData || {
      name: '',
      startMonth: 1,
      startDay: 1,
      endMonth: 12,
      endDay: 31,
    },
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 bg-muted/30">
      <div className="space-y-4">
        <div>
          <Label htmlFor="season-name" className="mb-1.5">
            Name
          </Label>
          <Input
            id="season-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Summer"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5">Starts</Label>
            <div className="flex gap-2">
              <Select
                value={String(formData.startMonth)}
                onValueChange={(v) => {
                  const newMonth = parseInt(v, 10)
                  const maxDay = getDaysInMonth(newMonth)
                  setFormData({ ...formData, startMonth: newMonth, startDay: Math.min(formData.startDay, maxDay) })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(formData.startDay)} onValueChange={(v) => setFormData({ ...formData, startDay: parseInt(v, 10) })}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: getDaysInMonth(formData.startMonth) }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Ends</Label>
            <div className="flex gap-2">
              <Select
                value={String(formData.endMonth)}
                onValueChange={(v) => {
                  const newMonth = parseInt(v, 10)
                  const maxDay = getDaysInMonth(newMonth)
                  setFormData({ ...formData, endMonth: newMonth, endDay: Math.min(formData.endDay, maxDay) })
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(formData.endDay)} onValueChange={(v) => setFormData({ ...formData, endDay: parseInt(v, 10) })}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: getDaysInMonth(formData.endMonth) }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <Button type="submit" size="sm" disabled={isSubmitting || !formData.name} loading={isSubmitting}>
          {isEditing ? 'Save' : 'Add season'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

const formatSeasonDate = (month: number, day: number) => `${months[month - 1]} ${day}`

const SeasonRow: React.FC<{
  season: Season
  onEdit: (season: Season) => void
  onDelete: (season: Season) => void
  onToggleActive: (season: Season) => void
}> = ({ season, onEdit, onDelete, onToggleActive }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-6 py-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground truncate">{season.name}</p>
        {season.isActive && <Badge variant="success">Active</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatSeasonDate(season.startMonth, season.startDay)} to {formatSeasonDate(season.endMonth, season.endDay)}
      </p>
    </div>

    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={() => onToggleActive(season)} className="mr-1">
        {season.isActive ? 'Deactivate' : 'Activate'}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(season)} aria-label={`Edit ${season.name}`}>
        <Edit2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(season)}
        aria-label={`Delete ${season.name}`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
)

export const SeasonManagementPanel: React.FC = () => {
  const { data: seasons = [], isLoading, error, mutate } = useSeasons()
  const { addToast } = useToast()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Season | null>(null)

  const handleCreateSeason = async (data: SeasonFormData) => {
    const result = await createSeason(data)
    if (result.success) {
      addToast('success', 'Season added')
      setIsAddingNew(false)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to add season')
    }
  }

  const handleUpdateSeason = async (id: string, data: SeasonFormData) => {
    const result = await updateSeason(id, data)
    if (result.success) {
      addToast('success', 'Season saved')
      setEditingSeasonId(null)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to save season')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    const result = await deleteSeason(deleteConfirm.id)
    if (result.success) {
      addToast('success', 'Season deleted')
      mutate()
    } else {
      addToast('error', result.error || 'Failed to delete season')
    }

    setDeleteConfirm(null)
  }

  // only one season can be active, so activating one deactivates the current one first
  const handleToggleActive = async (season: Season) => {
    const activate = !season.isActive
    if (activate) {
      for (const other of seasons.filter((s) => s.isActive && s.id !== season.id)) {
        const result = await toggleSeasonActive(other.id, false)
        if (!result.success) {
          addToast('error', result.error || 'Failed to update season')
          return
        }
      }
    }

    const result = await toggleSeasonActive(season.id, activate)
    if (result.success) {
      addToast('success', `${season.name} ${activate ? 'activated' : 'deactivated'}`)
    } else {
      addToast('error', result.error || 'Failed to update season')
    }
    mutate()
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return <SettingsError message={`Failed to load seasons: ${error.message}`} />
  }

  return (
    <>
      <SettingsSection
        title="Seasons"
        description="The active season sets the default dashboard period and the season options in the period selector."
        flush
        action={
          !isAddingNew &&
          !editingSeasonId && (
            <Button size="sm" onClick={() => setIsAddingNew(true)}>
              <Plus className="w-4 h-4" />
              Add season
            </Button>
          )
        }
      >
        <div className="divide-y divide-border/60">
          {isAddingNew && <SeasonForm onSubmit={handleCreateSeason} onCancel={() => setIsAddingNew(false)} />}
          {seasons.length === 0 && !isAddingNew && <p className="px-4 sm:px-6 py-4 text-sm text-muted-foreground">No seasons</p>}
          {seasons.map((season: Season) =>
            editingSeasonId === season.id ? (
              <SeasonForm
                key={season.id}
                initialData={{
                  name: season.name,
                  startMonth: season.startMonth,
                  startDay: season.startDay,
                  endMonth: season.endMonth,
                  endDay: season.endDay,
                }}
                onSubmit={(data) => handleUpdateSeason(season.id, data)}
                onCancel={() => setEditingSeasonId(null)}
                isEditing
              />
            ) : (
              <SeasonRow
                key={season.id}
                season={season}
                onEdit={(s) => setEditingSeasonId(s.id)}
                onDelete={setDeleteConfirm}
                onToggleActive={handleToggleActive}
              />
            ),
          )}
        </div>
      </SettingsSection>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Delete season?"
        message={`"${deleteConfirm?.name}" will be removed from the period selector.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}
