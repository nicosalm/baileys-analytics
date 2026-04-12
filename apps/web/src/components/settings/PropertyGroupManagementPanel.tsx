import React, { useState } from 'react'
import {
  usePropertyGroups,
  useProperties,
  createPropertyGroup,
  updatePropertyGroup,
  deletePropertyGroup
} from '@/hooks/use-api'
import type { PropertyGroup } from '@/hooks/use-api'
import { Plus, Edit2, Layers, Trash2, Home } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@baileys/utils'

interface GroupFormData {
  name: string
  description: string
  propertyIds: string[]
}

const GroupForm: React.FC<{
  initialData?: GroupFormData
  onSubmit: (data: GroupFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}> = ({ initialData, onSubmit, onCancel, isEditing = false }) => {
  const [formData, setFormData] = useState<GroupFormData>(
    initialData || { name: '', description: '', propertyIds: [] }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: availableProperties = [] } = useProperties()

  const toggleProperty = (propertyId: string) => {
    setFormData(prev => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter(id => id !== propertyId)
        : [...prev.propertyIds, propertyId]
    }))
  }

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
    <form onSubmit={handleSubmit} className="bg-card rounded-lg shadow-sm border p-6">
      <div className="space-y-4">
        <div>
          <Label className="mb-1">Group Name</Label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Beach Rentals"
            required
          />
        </div>

        <div>
          <Label className="mb-1">Description (optional)</Label>
          <Input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Short description"
          />
        </div>

        <div>
          <Label className="mb-2 block">Properties</Label>
          {availableProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties available</p>
          ) : (
            <div className="space-y-1 max-h-[240px] overflow-y-auto rounded-md border p-2">
              {availableProperties.map(property => (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => toggleProperty(property.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left cursor-pointer",
                    formData.propertyIds.includes(property.id)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-sm flex-shrink-0 border transition-colors",
                      formData.propertyIds.includes(property.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  />
                  <Home className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  <span>{property.name}</span>
                </button>
              ))}
            </div>
          )}
          {formData.propertyIds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {formData.propertyIds.length} propert{formData.propertyIds.length === 1 ? 'y' : 'ies'} selected
            </p>
          )}
        </div>
      </div>

      <Separator className="mt-6" />
      <div className="flex items-center gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting || !formData.name}>
          {isEditing ? 'Save Changes' : 'Create Group'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

const GroupRow: React.FC<{
  group: PropertyGroup
  propertyNames: Map<string, string>
  onEdit: (group: PropertyGroup) => void
  onDelete: (group: PropertyGroup) => void
}> = ({ group, propertyNames, onEdit, onDelete }) => (
  <div className="bg-card rounded-lg shadow-sm border p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Layers className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h4 className="font-medium text-foreground">{group.name}</h4>
          <p className="text-sm text-muted-foreground mt-0.5">
            {group.memberCount} propert{group.memberCount === 1 ? 'y' : 'ies'}
            {group.description && <> &middot; {group.description}</>}
          </p>
          {group.propertyIds.length > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-1 truncate max-w-md">
              {group.propertyIds
                .map(id => propertyNames.get(id) || 'Unknown')
                .join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(group)} title="Edit">
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(group)} title="Delete" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
)

export const PropertyGroupManagementPanel: React.FC = () => {
  const { data: groups = [], isLoading, error, mutate } = usePropertyGroups()
  const { data: properties = [] } = useProperties()
  const { addToast } = useToast()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; group: PropertyGroup | null }>({ show: false, group: null })

  const propertyNames = new Map(properties.map(p => [p.id, p.name]))

  const handleCreate = async (data: GroupFormData) => {
    const result = await createPropertyGroup({
      name: data.name,
      description: data.description || undefined,
      propertyIds: data.propertyIds
    })
    if (result.success) {
      addToast('success', 'Property group created')
      setIsAddingNew(false)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to create group')
    }
  }

  const handleUpdate = async (id: string, data: GroupFormData) => {
    const result = await updatePropertyGroup(id, {
      name: data.name,
      description: data.description || undefined,
      propertyIds: data.propertyIds
    })
    if (result.success) {
      addToast('success', 'Property group updated')
      setEditingGroupId(null)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to update group')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.group) return

    const result = await deletePropertyGroup(deleteConfirm.group.id)
    if (result.success) {
      addToast('success', 'Property group deleted')
      mutate()
    } else {
      addToast('error', result.error || 'Failed to delete group')
    }

    setDeleteConfirm({ show: false, group: null })
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div className="bg-danger-subtle border border-danger/30 rounded-lg p-4">
        <p className="text-danger-fg">Failed to load property groups: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Property Groups</h3>
            <p className="text-muted-foreground text-sm">
              Group properties for quick selection in the filter bar
            </p>
          </div>
          {!isAddingNew && !editingGroupId && (
            <Button size="sm" onClick={() => setIsAddingNew(true)}>
              <Plus className="w-4 h-4" />
              Add Group
            </Button>
          )}
        </div>

        {groups.length === 0 && !isAddingNew ? (
          <div className="bg-muted/40 border rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No property groups yet</p>
          </div>
        ) : null}
      </div>

      {isAddingNew && (
        <GroupForm
          onSubmit={handleCreate}
          onCancel={() => setIsAddingNew(false)}
        />
      )}

      {groups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Your Groups</h3>
          {groups.map((group: PropertyGroup) => (
            editingGroupId === group.id ? (
              <GroupForm
                key={group.id}
                initialData={{
                  name: group.name,
                  description: group.description || '',
                  propertyIds: group.propertyIds
                }}
                onSubmit={(data) => handleUpdate(group.id, data)}
                onCancel={() => setEditingGroupId(null)}
                isEditing
              />
            ) : (
              <GroupRow
                key={group.id}
                group={group}
                propertyNames={propertyNames}
                onEdit={(g) => setEditingGroupId(g.id)}
                onDelete={(g) => setDeleteConfirm({ show: true, group: g })}
              />
            )
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, group: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Property Group"
        message={`Are you sure you want to delete the "${deleteConfirm.group?.name}" group? This will not affect the properties themselves.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
