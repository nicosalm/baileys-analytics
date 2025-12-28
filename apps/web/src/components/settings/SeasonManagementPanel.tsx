import React, { useState } from 'react'
import { useSeasons, createSeason, updateSeason, deleteSeason, toggleSeasonActive } from '@/hooks/use-api'
import { Plus, Edit2, Calendar, Check, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Season Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Summer Season"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="flex gap-2">
              <select
                value={formData.startMonth}
                onChange={(e) => setFormData({ ...formData, startMonth: parseInt(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {months.map((month, index) => (
                  <option key={index} value={index + 1}>{month}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.startDay}
                onChange={(e) => setFormData({ ...formData, startDay: parseInt(e.target.value) || 1 })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="flex gap-2">
              <select
                value={formData.endMonth}
                onChange={(e) => setFormData({ ...formData, endMonth: parseInt(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {months.map((month, index) => (
                  <option key={index} value={index + 1}>{month}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.endDay}
                onChange={(e) => setFormData({ ...formData, endDay: parseInt(e.target.value) || 1 })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6 pt-4 border-t">
        <button
          type="submit"
          disabled={isSubmitting || !formData.name}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isEditing ? 'Save Changes' : 'Add Season'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          Cancel
        </button>
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
    <div className={`bg-white rounded-xl border p-4 transition-colors ${
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
            <button
              onClick={() => onToggleActive(season)}
              className="px-3 py-1.5 text-gray-600 text-sm rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => onToggleActive(season)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:opacity-90 cursor-pointer"
            >
              Activate
            </button>
          )}
          <button
            onClick={() => onEdit(season)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(season)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Season Management</h2>
            <p className="text-gray-600 text-sm">
              Define seasons to filter analytics by booking periods
            </p>
          </div>
          {!isAddingNew && !editingSeasonId && (
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:opacity-90 flex items-center gap-2 cursor-pointer font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Season
            </button>
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