import { useState } from 'react'
import { Download, Trash2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { LoadingButton } from '@/components/LoadingButton'

export const AccountTab = () => {
  const { state, logout } = useAuth()
  const { addToast } = useToast()
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  if (state.status !== 'authenticated') {
    return null
  }

  const { user } = state

  const handleExportData = async () => {
    try {
      setExportLoading(true)
      const result = await api.request('/account/export', { method: 'GET' })

      if (result.success && result.data) {
        // create download link
        const dataStr = JSON.stringify(result.data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `baileys-analytics-data-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        addToast('success', 'Data exported successfully')
      } else {
        addToast('error', 'Failed to export data')
      }
    } catch (error) {
      addToast('error', 'Failed to export data')
    } finally {
      setExportLoading(false)
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Account Created</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* data export */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Export Your Data</h2>
            <p className="text-sm text-gray-600">
              Download all your data as a JSON file. Includes properties, bookings, guests, and all settings.
            </p>
          </div>
          <Download className="w-6 h-6 text-blue-600" />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>GDPR Compliance:</strong> You have the right to access and export all your personal data at any time.
          </p>
        </div>

        <LoadingButton
          onClick={handleExportData}
          loading={exportLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Data as JSON
        </LoadingButton>
      </div>

      {/* danger zone */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-gray-600">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-800 mb-2">
            <strong>Warning:</strong> Deleting your account will:
          </p>
          <ul className="text-sm text-red-700 list-disc ml-6 space-y-1">
            <li>Permanently delete all properties, bookings, and guest data</li>
            <li>Cancel your subscription and stop all billing</li>
            <li>Revoke access to your OwnerRez account</li>
            <li>Delete all generated reports and settings</li>
            <li>Remove all your personal information from our systems</li>
          </ul>
        </div>

        <button
          onClick={() => setDeleteModalOpen(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account Permanently
        </button>
      </div>

      {/* delete confirmation modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Delete Account Permanently</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Warning:</strong> This action cannot be undone.
              </p>
              <p className="text-sm text-red-700">
                All your data will be permanently deleted and your subscription will be canceled.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="DELETE"
                disabled={deleteLoading}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteConfirmText('')
                }}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <LoadingButton
                onClick={handleDeleteAccount}
                loading={deleteLoading}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Forever
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
