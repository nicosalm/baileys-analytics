import React, { useState } from 'react'
import { useSeasons, createSeason, updateSeason, deleteSeason, toggleSeasonActive } from '@/hooks/use-api'
import { Plus, Edit2, Calendar, Check, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Season, SeasonFormData } from '@/types/season'

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

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
      endDay: 31
    }
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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4">
        <div>
          <Label className="mb-1">Season Name</Label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Summer Season"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1">Start Date</Label>
            <div className="flex gap-2">
              <Select value={String(formData.startMonth)} onValueChange={(v) => setFormData({ ...formData, startMonth: parseInt(v) })}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={String(index + 1)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={31}
                value={formData.startDay}
                onChange={(e) => setFormData({ ...formData, startDay: parseInt(e.target.value) || 1 })}
                className="w-20"
                required
              />
            </div>
          </div>

          <div>
            <Label className="mb-1">End Date</Label>
            <div className="flex gap-2">
              <Select value={String(formData.endMonth)} onValueChange={(v) => setFormData({ ...formData, endMonth: parseInt(v) })}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={String(index + 1)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={31}
                value={formData.endDay}
                onChange={(e) => setFormData({ ...formData, endDay: parseInt(e.target.value) || 1 })}
                className="w-20"
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6 pt-4">
        <Separator className="mb-4" />
        <Button type="submit" disabled={isSubmitting || !formData.name}>
          {isEditing ? 'Save Changes' : 'Add Season'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

const SeasonRow: React.FC<{
  season: Season
  onEdit: (season: Season) => void
  onDelete: (season: Season) => void
  onToggleActive: (season: Season) => void
}> = ({ season, onEdit, onDelete, onToggleActive }) => {
  const formatSeasonDate = (month: number, day: number) => {
    return `${months[month - 1]} ${day}`
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 transition-colors ${
      season.isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            season.isActive ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Calendar className={`w-5 h-5 ${season.isActive ? 'text-green-600' : 'text-gray-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">{season.name}</h4>
              {season.isActive && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatSeasonDate(season.startMonth, season.startDay)} – {formatSeasonDate(season.endMonth, season.endDay)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {season.isActive ? (
            <Button variant="ghost" size="sm" onClick={() => onToggleActive(season)}>
              Deactivate
            </Button>
          ) : (
            <Button size="sm" onClick={() => onToggleActive(season)}>
              Activate
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(season)} title="Edit">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(season)} title="Delete" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export const SeasonManagementPanel: React.FC = () => {
  const { data: seasons = [], isLoading, error, mutate } = useSeasons()
  const { addToast } = useToast()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; season: Season | null }>({ show: false, season: null })

  const activeSeason = seasons.find(s => s.isActive)

  const handleCreateSeason = async (data: SeasonFormData) => {
    const result = await createSeason(data)
    if (result.success) {
      addToast('success', 'Season created successfully')
      setIsAddingNew(false)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to create season')
    }
  }

  const handleUpdateSeason = async (id: string, data: SeasonFormData) => {
    const result = await updateSeason(id, data)
    if (result.success) {
      addToast('success', 'Season updated successfully')
      setEditingSeasonId(null)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to update season')
    }
  }

  const handleDeleteSeason = (season: Season) => {
    setDeleteConfirm({ show: true, season })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.season) return
    
    const result = await deleteSeason(deleteConfirm.season.id)
    if (result.success) {
      addToast('success', 'Season deleted successfully')
      mutate()
    } else {
      addToast('error', result.error || 'Failed to delete season')
    }
    
    setDeleteConfirm({ show: false, season: null })
  }

  const handleToggleActive = async (season: Season) => {
    if (!season.isActive) {
      const activeSeasons = seasons.filter(s => s.isActive && s.id !== season.id)
      if (activeSeasons.length > 0) {
        addToast('error', 'Only one season can be active. Please deactivate the current season first.')
        return
      }
    }
    
    const result = await toggleSeasonActive(season.id, !season.isActive)
    if (result.success) {
      addToast(
        'success',
        `Season ${!season.isActive ? 'activated' : 'deactivated'} successfully`
      )
      mutate()
    } else {
      addToast('error', result.error || 'Failed to update season')
    }
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Failed to load seasons: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Season Management</h2>
            <p className="text-gray-600 text-sm">
              Define seasons to filter analytics by booking periods
            </p>
          </div>
          {!isAddingNew && !editingSeasonId && (
            <Button size="sm" onClick={() => setIsAddingNew(true)}>
              <Plus className="w-4 h-4" />
              Add Season
            </Button>
          )}
        </div>

        {activeSeason ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Active Season: {activeSeason.name}</p>
              <p className="text-xs text-green-700">
                {months[activeSeason.startMonth - 1]} {activeSeason.startDay} – {months[activeSeason.endMonth - 1]} {activeSeason.endDay}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">No active season — showing all data</p>
          </div>
        )}
      </div>

      {isAddingNew && (
        <SeasonForm
          onSubmit={handleCreateSeason}
          onCancel={() => setIsAddingNew(false)}
        />
      )}

      {seasons.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Your Seasons</h3>
          {seasons.map((season: Season) => (
            editingSeasonId === season.id ? (
              <SeasonForm
                key={season.id}
                initialData={{
                  name: season.name,
                  startMonth: season.startMonth,
                  startDay: season.startDay,
                  endMonth: season.endMonth,
                  endDay: season.endDay
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
                onDelete={handleDeleteSeason}
                onToggleActive={handleToggleActive}
              />
            )
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, season: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Season"
        message={`Are you sure you want to delete the "${deleteConfirm.season?.name}" season? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}