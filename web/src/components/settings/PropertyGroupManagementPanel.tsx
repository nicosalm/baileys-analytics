import type React from 'react'
import { useState } from 'react'
import { usePropertyGroups, useProperties, createPropertyGroup, updatePropertyGroup, deletePropertyGroup } from '@/hooks/use-api'
import type { PropertyGroup } from '@/hooks/use-api'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { SettingsSection, SettingsError } from './SettingsSection'

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
  const [formData, setFormData] = useState<GroupFormData>(initialData || { name: '', description: '', propertyIds: [] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: availableProperties = [] } = useProperties()

  const toggleProperty = (propertyId: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter((id) => id !== propertyId)
        : [...prev.propertyIds, propertyId],
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
    <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 bg-muted/30">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="group-name" className="mb-1.5">
              Name
            </Label>
            <Input
              id="group-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Lakefront"
              required
            />
          </div>
          <div>
            <Label htmlFor="group-description" className="mb-1.5">
              Description
            </Label>
            <Input
              id="group-description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            Properties
            {formData.propertyIds.length > 0 && (
              <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{formData.propertyIds.length} selected</span>
            )}
          </legend>
          {availableProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 max-h-60 overflow-y-auto rounded-md border border-border bg-background p-1">
              {availableProperties.map((property) => (
                <label
                  key={property.id}
                  htmlFor={`group-property-${property.id}`}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    id={`group-property-${property.id}`}
                    checked={formData.propertyIds.includes(property.id)}
                    onCheckedChange={() => toggleProperty(property.id)}
                  />
                  <span className="truncate">{property.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <Button type="submit" size="sm" disabled={isSubmitting || !formData.name} loading={isSubmitting}>
          {isEditing ? 'Save' : 'Create group'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
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
}> = ({ group, propertyNames, onEdit, onDelete }) => {
  const members = group.propertyIds.map((id) => propertyNames.get(id) || 'Unknown').join(', ')

  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
          <Badge variant="neutral" className="tabular-nums">
            {group.memberCount}
          </Badge>
        </div>
        {(group.description || members) && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate" title={members}>
            {group.description || members}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(group)} aria-label={`Edit ${group.name}`}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(group)}
          aria-label={`Delete ${group.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export const PropertyGroupManagementPanel: React.FC = () => {
  const { data: groups = [], isLoading, error, mutate } = usePropertyGroups()
  const { data: properties = [] } = useProperties()
  const { addToast } = useToast()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<PropertyGroup | null>(null)

  const propertyNames = new Map(properties.map((p) => [p.id, p.name]))

  const handleCreate = async (data: GroupFormData) => {
    const result = await createPropertyGroup({
      name: data.name,
      description: data.description || undefined,
      propertyIds: data.propertyIds,
    })
    if (result.success) {
      addToast('success', 'Group created')
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
      propertyIds: data.propertyIds,
    })
    if (result.success) {
      addToast('success', 'Group saved')
      setEditingGroupId(null)
      mutate()
    } else {
      addToast('error', result.error || 'Failed to save group')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    const result = await deletePropertyGroup(deleteConfirm.id)
    if (result.success) {
      addToast('success', 'Group deleted')
      mutate()
    } else {
      addToast('error', result.error || 'Failed to delete group')
    }

    setDeleteConfirm(null)
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return <SettingsError message={`Failed to load property groups: ${error.message}`} />
  }

  return (
    <>
      <SettingsSection
        title="Property groups"
        description="Groups appear as one-click selections in the property filter."
        flush
        action={
          !isAddingNew &&
          !editingGroupId && (
            <Button size="sm" onClick={() => setIsAddingNew(true)}>
              <Plus className="w-4 h-4" />
              Add group
            </Button>
          )
        }
      >
        <div className="divide-y divide-border/60">
          {isAddingNew && <GroupForm onSubmit={handleCreate} onCancel={() => setIsAddingNew(false)} />}
          {groups.length === 0 && !isAddingNew && <p className="px-4 sm:px-6 py-4 text-sm text-muted-foreground">No groups</p>}
          {groups.map((group: PropertyGroup) =>
            editingGroupId === group.id ? (
              <GroupForm
                key={group.id}
                initialData={{
                  name: group.name,
                  description: group.description || '',
                  propertyIds: group.propertyIds,
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
                onDelete={setDeleteConfirm}
              />
            ),
          )}
        </div>
      </SettingsSection>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Delete group?"
        message={`"${deleteConfirm?.name}" will be deleted. Its properties are not affected.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}
