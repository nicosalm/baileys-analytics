import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { formatDateDisplay } from '@baileys/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { SettingsSection, SettingsRow } from './SettingsSection'

const DELETION_SUMMARY =
  'Removes your login, cancels your subscription, disconnects OwnerRez, and deletes all synced and entered data. This cannot be undone.'

interface AccountTabProps {
  onChangeEmail?: () => void
  onChangePassword?: () => void
}

export const AccountTab = ({ onChangeEmail, onChangePassword }: AccountTabProps) => {
  const { state, logout, setCompanyName } = useAuth()
  const { addToast } = useToast()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [companyNameInput, setCompanyNameInput] = useState('')
  const [companyNameSaving, setCompanyNameSaving] = useState(false)

  const user = state.status === 'authenticated' ? state.user : null

  useEffect(() => {
    if (user?.companyName) {
      setCompanyNameInput(user.companyName)
    }
  }, [user?.companyName])

  if (!user) {
    return null
  }

  const companyNameUnchanged = companyNameInput.trim() === (user.companyName || '')

  const handleSaveCompanyName = async () => {
    if (companyNameUnchanged) return
    const trimmed = companyNameInput.trim()

    try {
      setCompanyNameSaving(true)
      const result = await api.request<{ company_name: string | null }>('/account/company-name', {
        method: 'PATCH',
        body: JSON.stringify({ company_name: trimmed || null }),
      })

      if (result.success) {
        setCompanyName(result.data?.company_name ?? null)
        addToast('success', 'Company name saved')
      } else {
        addToast('error', result.error || 'Failed to save company name')
      }
    } catch {
      addToast('error', 'Failed to save company name')
    } finally {
      setCompanyNameSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    try {
      setDeleteLoading(true)
      const result = await api.request('/account/delete', { method: 'DELETE' })

      if (result.success) {
        addToast('success', 'Account deleted')
        try {
          await logout()
        } catch {
          // the session is usually gone by now
        }
        window.location.href = '/'
        return
      }
      addToast('error', result.error || 'Failed to delete account')
    } catch {
      addToast('error', 'Failed to delete account')
    }
    setDeleteLoading(false)
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Account">
        <SettingsRow label="Email">
          <span className="truncate">{user.email}</span>
          {onChangeEmail && (
            <Button variant="outline" size="sm" onClick={onChangeEmail}>
              Change
            </Button>
          )}
        </SettingsRow>
        {onChangePassword && (
          <SettingsRow label="Password">
            <Button variant="outline" size="sm" onClick={onChangePassword}>
              Change
            </Button>
          </SettingsRow>
        )}
        <SettingsRow label="Member since">{formatDateDisplay(user.created_at)}</SettingsRow>
      </SettingsSection>

      <SettingsSection title="Company name" description="Shown in the header.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleSaveCompanyName()
          }}
        >
          <Label htmlFor="company-name" className="sr-only">
            Company name
          </Label>
          <Input
            id="company-name"
            value={companyNameInput}
            onChange={(e) => setCompanyNameInput(e.target.value)}
            placeholder="Lakeside Rentals"
            maxLength={100}
            disabled={companyNameSaving}
            className="flex-1"
          />
          <Button type="submit" loading={companyNameSaving} disabled={companyNameUnchanged}>
            Save
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Delete account"
        description={DELETION_SUMMARY}
        tone="danger"
        action={
          <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(true)}>
            <Trash2 className="w-4 h-4" />
            Delete account
          </Button>
        }
      />

      <AlertDialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setDeleteModalOpen(false)
            setDeleteConfirmText('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account</AlertDialogTitle>
            <AlertDialogDescription>{DELETION_SUMMARY}</AlertDialogDescription>
          </AlertDialogHeader>

          <div>
            <Label htmlFor="delete-confirm" className="mb-2">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
              placeholder="DELETE"
              autoComplete="off"
              disabled={deleteLoading}
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteAccount} loading={deleteLoading} disabled={deleteConfirmText !== 'DELETE'}>
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
