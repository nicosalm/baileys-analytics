import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle, Lock, MessageSquare, ChevronRight, Check } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
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

  const handleSaveCompanyName = async () => {
    const trimmed = companyNameInput.trim()
    if (trimmed === (user.companyName || '')) return

    try {
      setCompanyNameSaving(true)
      const result = await api.request<{ company_name: string | null }>('/account/company-name', {
        method: 'PATCH',
        body: JSON.stringify({ company_name: trimmed || null }),
      })

      if (result.success) {
        setCompanyName(result.data?.company_name ?? null)
        addToast('success', 'Company name updated')
      } else {
        addToast('error', result.error || 'Failed to update company name')
      }
    } catch {
      addToast('error', 'Failed to update company name')
    } finally {
      setCompanyNameSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast('error', 'Please type DELETE to confirm')
      return
    }

    try {
      setDeleteLoading(true)
      const result = await api.request('/account/delete', { method: 'DELETE' })

      if (result.success) {
        addToast('success', 'Account deleted successfully')
        // clear auth state and redirect immediately
        try {
          await logout()
        } catch {
          // logout might fail if session already invalid, that's ok
        }
        window.location.href = '/'
        return
      } else {
        addToast('error', result.error || 'Failed to delete account')
        setDeleteLoading(false)
      }
    } catch (error) {
      addToast('error', 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* account info */}
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Account</h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/60">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium text-foreground">{user.email}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/60">
            <span className="text-sm text-muted-foreground">Account Created</span>
            <span className="text-sm font-medium text-foreground">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* company name */}
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">Company Name</h3>
        <p className="text-sm text-muted-foreground mb-4">Appears in the dashboard header next to Baileys Analytics</p>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="company-name" className="sr-only">
              Company Name
            </Label>
            <Input
              id="company-name"
              value={companyNameInput}
              onChange={(e) => setCompanyNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCompanyName()}
              placeholder="e.g. Lakeside Rentals"
              maxLength={100}
              disabled={companyNameSaving}
            />
          </div>
          <Button
            onClick={handleSaveCompanyName}
            loading={companyNameSaving}
            disabled={companyNameInput.trim() === (user.companyName || '')}
          >
            <Check className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* security */}
      {(onChangeEmail || onChangePassword) && (
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Security</h3>
          <div className="space-y-3">
            {onChangeEmail && (
              <Button variant="outline" onClick={onChangeEmail} className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Change Email</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
            {onChangePassword && (
              <Button variant="outline" onClick={onChangePassword} className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Change Password</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* danger zone */}
      <div className="bg-card rounded-lg shadow-sm border border-danger/30 p-6">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-danger-fg">Danger Zone</h3>
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Deletion is permanent. Your data cannot be recovered.</p>

        <div className="bg-danger-subtle border border-danger/30 rounded-lg p-4 mb-4">
          <p className="text-sm text-danger-fg mb-2">
            <strong>Warning:</strong> Deleting your account will:
          </p>
          <ul className="text-sm text-danger-fg list-disc ml-6 space-y-1">
            <li>Permanently delete all properties, bookings, and guest data</li>
            <li>Cancel your subscription and stop all billing</li>
            <li>Revoke access to your OwnerRez account</li>
            <li>Delete all generated reports and settings</li>
            <li>Remove all your personal information from our systems</li>
          </ul>
        </div>

        <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
          <Trash2 className="w-4 h-4" />
          Delete Account Permanently
        </Button>
      </div>

      {/* delete confirmation modal */}
      <AlertDialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false)
            setDeleteConfirmText('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All your data will be permanently deleted and your subscription will be canceled.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-danger-subtle border border-danger/30 rounded-lg p-4">
            <p className="text-sm text-danger-fg mb-2">
              <strong>Warning:</strong> This will permanently delete:
            </p>
            <ul className="text-sm text-danger-fg list-disc ml-6 space-y-1">
              <li>All properties, bookings, and guest data</li>
              <li>Your subscription and billing</li>
              <li>All reports and settings</li>
            </ul>
          </div>

          <div>
            <Label className="mb-2">
              Type <strong>DELETE</strong> to confirm:
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleteLoading}
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteAccount} loading={deleteLoading} disabled={deleteConfirmText !== 'DELETE'}>
              Delete Forever
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
