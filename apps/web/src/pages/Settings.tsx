import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense, ComponentType } from 'react'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { LoadingState } from '@/components/LoadingState'
import { 
  Calendar, Calculator, 
  Trash2, 
  LogOut, Settings as SettingsIcon, Compass,
  Palette, CreditCard, Link2,
  Lock, MessageSquare, ChevronRight, ArrowLeft
} from 'lucide-react'
import { formatDateDisplay } from '@baileys/utils'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { ConfirmModal } from '@/components/ConfirmModal'

const TaxManagementPanel = lazy(() => 
  import('@/components/settings/TaxManagementPanel').then(m => ({ default: m.TaxManagementPanel }))
)

const SeasonManagementPanel = lazy(() => 
  import('@/components/settings/SeasonManagementPanel').then(m => ({ default: m.SeasonManagementPanel }))
)

const IntegrationsTab = lazy(() => 
  import('@/components/settings/IntegrationsTab').then(m => ({ default: m.IntegrationsTab }))
)

const BillingTab = lazy(() => 
  import('@/components/settings/BillingTab').then(m => ({ default: m.BillingTab }))
)

type SettingsTab = 'general' | 'preferences' | 'integrations' | 'billing' | 'tax' | 'seasons'

const tabConfig: { id: SettingsTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { 
    id: 'general', 
    label: 'General', 
    icon: SettingsIcon
  },
  { 
    id: 'preferences',
    label: 'Preferences',
    icon: Palette
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Link2
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard
  },
  {
    id: 'tax',
    label: 'Platform Fees',
    icon: Calculator
  },
  { 
    id: 'seasons', 
    label: 'Seasons', 
    icon: Calendar
  }
]

const GeneralTab = ({ 
  email, 
  createdAt, 
  companyName,
  onResetPassword,
  onDeleteAccount
}: {
  email: string
  createdAt: string
  companyName?: string | null
  onResetPassword: () => void
  onDeleteAccount: () => void
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{email}</span>
          </div>
          {companyName && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Company</span>
              <span className="text-sm font-medium text-gray-900">{companyName}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Member Since</span>
            <span className="text-sm font-medium text-gray-900">{formatDateDisplay(new Date(createdAt))}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
        <div className="space-y-3">
          <button
            onClick={onResetPassword}
            className="w-full px-4 py-2 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-between border border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Change Password</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-600">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
        <button
          onClick={onDeleteAccount}
          className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-all flex items-center gap-2 border border-red-200"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>
    </div>
  )
}

const PreferencesTab = () => {
  const { showTips, toggleTips } = useTips()
  const { addToast } = useToast()
  const [notifications, setNotifications] = useState(true)

  const handleToggleTips = () => {
    toggleTips()
    addToast('success', showTips ? 'Tips disabled' : 'Tips enabled')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Display Preferences</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-gray-700">Tips & Hints</span>
              <p className="text-xs text-gray-500 mt-0.5">Show helpful tips throughout the dashboard</p>
            </div>
            <button
              onClick={handleToggleTips}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showTips ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  showTips ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-gray-700">Email Notifications</span>
              <p className="text-xs text-gray-500 mt-0.5">Receive updates about your account and syncs</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Settings = () => {
  const { state, logout } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab')
    return (tab as SettingsTab) || 'general'
  })
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false)

  // Handle checkout success/cancel from Stripe
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      addToast('success', 'Subscription activated successfully! Welcome to Baileys Analytics.')
      // Remove checkout param from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('checkout')
      setSearchParams(newParams, { replace: true })
    } else if (checkout === 'cancel') {
      addToast('info', 'Checkout canceled. You can complete your subscription anytime.')
      // Remove checkout param from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('checkout')
      setSearchParams(newParams, { replace: true })
    }
  }, [])

  if (state.status === 'loading') {
    return <LoadingState />
  }

  if (state.status !== 'authenticated') {
    return null
  }

  const { user } = state

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }
  
  const handleResetPassword = async () => {
    const { resetPassword } = await import('@/contexts/auth').then(m => ({ resetPassword: m.useAuth().resetPassword }))
    const result = await resetPassword(user.email!)
    if (result) {
      addToast('success', 'Password reset email sent')
    } else {
      addToast('error', 'Failed to send password reset email')
    }
  }
  
  const handleDeleteAccount = async () => {
    addToast('info', 'Account deletion is not available during beta')
    setDeleteAccountModalOpen(false)
  }
  
  const handleSendFeedback = () => {
    window.open('https://github.com/baileys-analytics/feedback/issues', '_blank')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/dashboard/overview" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                  <Compass className="w-6 h-6 text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-semibold text-gray-900">{BRAND.name}</h1>
                  {user.companyName && (
                    <p className="text-xs text-gray-500 -mt-0.5">for {user.companyName}</p>
                  )}
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/overview"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <button
                onClick={async () => {
                  await logout()
                  window.location.href = '/'
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 text-sm">Manage your account settings and preferences</p>
        </div>

        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1 bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
              {tabConfig.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleSendFeedback}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Send Feedback
              </button>
            </div>
          </div>

          <div className="flex-1">
            <Suspense fallback={<LoadingState />}>
              {activeTab === 'general' && (
                <GeneralTab
                  email={user.email!}
                  createdAt={user.created_at || new Date().toISOString()}
                  companyName={user.companyName}
                  onResetPassword={handleResetPassword}
                  onDeleteAccount={() => setDeleteAccountModalOpen(true)}
                />
              )}
              {activeTab === 'preferences' && <PreferencesTab />}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'billing' && <BillingTab />}
              {activeTab === 'tax' && <TaxManagementPanel />}
              {activeTab === 'seasons' && <SeasonManagementPanel />}
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
      
      <ConfirmModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        message="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmText="Delete Account"
        variant="danger"
      />
    </div>
  )
}