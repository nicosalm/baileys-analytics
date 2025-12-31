import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense, ComponentType, useCallback } from 'react'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { LoadingState } from '@/components/LoadingState'
import {
  Calendar, Calculator,
  LogOut, Compass,
  Palette, CreditCard, Link2,
  Lock, MessageSquare, ArrowLeft,
  Eye, EyeOff
} from 'lucide-react'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'

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

const AccountTab = lazy(() =>
  import('@/components/settings/AccountTab').then(m => ({ default: m.AccountTab }))
)

type SettingsTab = 'account' | 'preferences' | 'integrations' | 'billing' | 'tax' | 'seasons'

const tabConfig: { id: SettingsTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  {
    id: 'account',
    label: 'Account',
    icon: Lock
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Palette
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
  }
]

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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
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
  const { state, logout, updateEmail, updatePassword } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab')
    return (tab as SettingsTab) || 'account'
  })
  const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (changePasswordModalOpen && !isChangingPassword) {
          setChangePasswordModalOpen(false)
        } else if (changeEmailModalOpen && !isChangingEmail) {
          setChangeEmailModalOpen(false)
        }
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [changePasswordModalOpen, changeEmailModalOpen, isChangingPassword, isChangingEmail])

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

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }, [setSearchParams])

  const handleChangePassword = useCallback(() => {
    setChangePasswordModalOpen(true)
    setNewPassword('')
    setConfirmNewPassword('')
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }, [])

  const handleConfirmChangePassword = async () => {
    // Trim whitespace
    const trimmedPassword = newPassword.trim()
    const trimmedConfirm = confirmNewPassword.trim()

    if (!trimmedPassword) {
      addToast('error', 'Please enter a new password')
      return
    }

    if (trimmedPassword !== trimmedConfirm) {
      addToast('error', 'Passwords do not match')
      return
    }

    const { validatePassword } = await import('@/utils/password')
    const validation = validatePassword(trimmedPassword)
    if (!validation.isValid) {
      addToast('error', validation.errors[0])
      return
    }

    setIsChangingPassword(true)
    try {
      const result = await updatePassword(trimmedPassword)
      if (result) {
        addToast('success', 'Password changed successfully')
        setChangePasswordModalOpen(false)
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        addToast('error', 'Failed to change password. Please try again.')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeEmail = () => {
    setNewEmail('') // Clear state first
    setChangeEmailModalOpen(true)
  }

  const handleConfirmChangeEmail = async () => {
    const trimmedEmail = newEmail.trim()

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      addToast('error', 'Please enter a valid email address')
      return
    }

    if (trimmedEmail.toLowerCase() === user.email?.toLowerCase()) {
      addToast('error', 'New email must be different from current email')
      return
    }

    setIsChangingEmail(true)
    try {
      const result = await updateEmail(trimmedEmail)
      if (result) {
        addToast('success', 'Confirmation link sent to your new email. Click the link to complete the change.')
        setChangeEmailModalOpen(false)
        setNewEmail('')
      } else {
        addToast('error', 'Failed to update email. Please try again.')
      }
    } catch (error) {
      addToast('error', 'An error occurred while updating email.')
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handleSendFeedback = useCallback(() => {
    window.location.href = 'mailto:support@baileysanalytics.com'
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    window.location.href = '/'
  }, [logout])
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/dashboard/overview" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`w-9 h-9 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                  <Compass className="w-5 h-5 text-white" />
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
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 text-sm">Manage your account settings and preferences</p>
        </div>

        {/* mobile tab bar */}
        <div className="md:hidden mb-6">
          <nav className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {tabConfig.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <button
              onClick={handleSendFeedback}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </button>
          </nav>
        </div>

        <div className="flex gap-6">
          {/* desktop sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <nav className="space-y-1 bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
              {tabConfig.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
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
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Send Feedback
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <Suspense fallback={<LoadingState />}>
              {activeTab === 'account' && (
                <AccountTab
                  onChangeEmail={!user.isOAuthUser ? handleChangeEmail : undefined}
                  onChangePassword={!user.isOAuthUser ? handleChangePassword : undefined}
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

      {changeEmailModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingEmail) {
              setChangeEmailModalOpen(false)
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Email Address</h3>
            <p className="text-sm text-gray-600 mb-4">
              A confirmation link will be sent to your new email address. Click the link to complete the change.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isChangingEmail && handleConfirmChangeEmail()}
                  placeholder="your.new.email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  disabled={isChangingEmail}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setChangeEmailModalOpen(false)}
                disabled={isChangingEmail}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmChangeEmail}
                disabled={isChangingEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingEmail ? 'Sending...' : 'Send Confirmation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {changePasswordModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingPassword) {
              setChangePasswordModalOpen(false)
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your new password below. Must be at least 8 characters with uppercase, lowercase, and number.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isChangingPassword && handleConfirmChangePassword()}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    disabled={isChangingPassword}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isChangingPassword && handleConfirmChangePassword()}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    disabled={isChangingPassword}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setChangePasswordModalOpen(false)}
                disabled={isChangingPassword}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmChangePassword}
                disabled={isChangingPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}