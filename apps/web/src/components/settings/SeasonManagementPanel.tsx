import React, { useState } from 'react'
import { useSeasons, createSeason, updateSeason, deleteSeason, toggleSeasonActive } from '@/hooks/use-api'
import { Plus, Edit2, Trash2, Calendar, Check, X, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
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
}> = ({ season, onEdit, onDelete, onToggleActive }) => {
  const formatSeasonDate = (month: number, day: number) => {
    return `${months[month - 1]} ${day}`
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-gray-900">{season.name}</h4>
          {!season.isActive && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{formatSeasonDate(season.startMonth, season.startDay)} - {formatSeasonDate(season.endMonth, season.endDay)}</span>
          <span className="text-xs text-gray-500 ml-2">(repeats annually)</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleActive(season)}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
          title={season.isActive ? 'Deactivate season' : 'Activate season'}
        >
          {season.isActive ? (
            <ToggleRight className="w-5 h-5 text-green-600" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={() => onEdit(season)}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(season)}
          className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export const SeasonManagementPanel: React.FC = () => {
  const { data: seasons = [], isLoading, error, mutate } = useSeasons()
  const { addToast } = useToast()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)

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

  const handleDeleteSeason = async (season: Season) => {
    if (!confirm(`Are you sure you want to delete the "${season.name}" season?`)) {
      return
    }

    const result = await deleteSeason(season.id)
    if (result.success) {
      addToast('success', 'Season deleted successfully')
      mutate()
    } else {
      addToast('error', result.error || 'Failed to delete season')
    }
  }

  const handleToggleActive = async (season: Season) => {
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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Season Management</h3>
          <p className="text-sm text-gray-600 mt-1">
            Define your operational seasons to filter out off-season blocks and focus on actual booking periods.
          </p>
        </div>
        {!isAddingNew && !editingSeasonId && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Season
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">About Blocked Bookings</h4>
            <p className="text-sm text-blue-800 mt-1">
              Bookings tagged as "Blocked" in OwnerRez will be automatically excluded from all analytics and metrics.
              This ensures that property blocks don't affect your occupancy rates or revenue calculations.
            </p>
          </div>
        </div>
      </div>

      {isAddingNew && (
        <SeasonForm
          onSubmit={handleCreateSeason}
          onCancel={() => setIsAddingNew(false)}
        />
      )}

      <div className="space-y-3">
        {seasons.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
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
    </div>
  )
}