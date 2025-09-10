import React, { useState } from 'react'
import { useSeasons, createSeason, updateSeason, deleteSeason, toggleSeasonActive } from '@/hooks/use-api'
import { Plus, Edit2, Calendar, Check, X } from 'lucide-react'
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
      endMonth: 1,
      endDay: 1
    }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Season Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., High Season"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Month
          </label>
          <select
            value={formData.startMonth}
            onChange={(e) => setFormData({ ...formData, startMonth: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Day
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.startDay}
            onChange={(e) => setFormData({ ...formData, startDay: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Month
          </label>
          <select
            value={formData.endMonth}
            onChange={(e) => setFormData({ ...formData, endMonth: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Day
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.endDay}
            onChange={(e) => setFormData({ ...formData, endDay: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="submit"
          disabled={isSubmitting || !formData.name}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          {isEditing ? 'Update' : 'Add'} Season
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          <X className="w-4 h-4 inline mr-1" />
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
}> = ({ season, onEdit, onToggleActive }) => {
  const formatSeasonDate = (month: number, day: number) => {
    return `${months[month - 1]} ${day}`
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div>
              <h4 className="text-sm font-medium text-gray-900">{season.name}</h4>
              <div className="flex items-center gap-4 mt-1">
                {season.isActive ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Active Season
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    Inactive
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatSeasonDate(season.startMonth, season.startDay)} - {formatSeasonDate(season.endMonth, season.endDay)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {season.isActive ? (
              <button
                onClick={() => onToggleActive(season)}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => onToggleActive(season)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Activate
              </button>
            )}
            <button
              onClick={() => onEdit(season)}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
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
  
  const activeSeasons = seasons.filter(s => s.isActive).length
  const inactiveSeasons = seasons.filter(s => !s.isActive).length

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
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Season Management</h2>
            <p className="text-gray-600 text-sm">
              Define operational seasons to filter analytics by actual booking periods
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-2xl font-bold text-blue-600">
                {activeSeasons}
              </div>
              <div className="text-xs text-gray-500 mt-1">Active</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-2xl font-bold text-gray-400">
                {inactiveSeasons}
              </div>
              <div className="text-xs text-gray-500 mt-1">Inactive</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Configured Seasons</h3>
        {!isAddingNew && !editingSeasonId && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Season
          </button>
        )}
      </div>

      {isAddingNew && (
        <SeasonForm
          onSubmit={handleCreateSeason}
          onCancel={() => setIsAddingNew(false)}
        />
      )}

      <div className="space-y-3">
        {seasons.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No seasons defined yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your first season to start filtering your booking data
            </p>
          </div>
        ) : (
          seasons.map((season: Season) => (
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
          ))
        )}
      </div>

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