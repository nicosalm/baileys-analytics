import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense, ComponentType, useCallback } from 'react'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { useTheme } from '@/contexts/theme'
import { LoadingState } from '@/components/LoadingState'
import {
  Calendar, Calculator,
  LogOut,
  Palette, CreditCard, Link2,
  Lock, MessageSquare, ArrowLeft,
  Eye, EyeOff, Receipt, Target
} from 'lucide-react'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

const ExpenseManagementPanel = lazy(() =>
  import('@/components/settings/ExpenseManagementPanel').then(m => ({ default: m.ExpenseManagementPanel }))
)

const GoalManagementPanel = lazy(() =>
  import('@/components/settings/GoalManagementPanel').then(m => ({ default: m.GoalManagementPanel }))
)

type SettingsTab = 'account' | 'preferences' | 'goals' | 'integrations' | 'billing' | 'platform-fees' | 'seasons' | 'expenses'

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
    id: 'goals',
    label: 'Goals',
    icon: Target
  },
  {
    id: 'platform-fees',
    label: 'Platform Fees',
    icon: Calculator
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: Receipt
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

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
] as const

const PreferencesTab = () => {
  const { showTips, toggleTips } = useTips()
  const { addToast } = useToast()
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState(true)

  const handleToggleTips = () => {
    toggleTips()
    addToast('success', showTips ? 'Tips disabled' : 'Tips enabled')
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Appearance</h3>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm font-medium text-foreground">Color theme</span>
            <p className="text-xs text-muted-foreground mt-0.5">Choose light, dark, or follow your OS setting</p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {THEME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  theme === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Display Preferences</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-foreground">Tips & Hints</span>
              <p className="text-xs text-muted-foreground mt-0.5">Show helpful tips throughout the dashboard</p>
            </div>
            <Switch checked={showTips} onCheckedChange={handleToggleTips} />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-foreground">Email Notifications</span>
              <p className="text-xs text-muted-foreground mt-0.5">Receive updates about your account and syncs</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/dashboard/overview" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
                <div className="ml-3">
                  <h1 className="text-xl font-semibold text-foreground">{BRAND.name}</h1>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/overview"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account settings and preferences</p>
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
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <button
              onClick={handleSendFeedback}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </button>
          </nav>
        </div>

        <div className="flex gap-6">
          {/* desktop sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <nav className="space-y-1 bg-card/50 backdrop-blur-sm rounded-lg p-2 border border-border">
              {tabConfig.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-6 pt-6 border-t border-border">
              <button
                onClick={handleSendFeedback}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all cursor-pointer"
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
              {activeTab === 'goals' && <GoalManagementPanel />}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'billing' && <BillingTab />}
              {activeTab === 'platform-fees' && <TaxManagementPanel />}
              {activeTab === 'expenses' && <ExpenseManagementPanel />}
              {activeTab === 'seasons' && <SeasonManagementPanel />}
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />

      <Dialog open={changeEmailModalOpen} onOpenChange={(open) => !isChangingEmail && setChangeEmailModalOpen(open)}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              A confirmation link will be sent to your new email address. Click the link to complete the change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-email" className="mb-2">
                Current Email
              </Label>
              <Input
                id="current-email"
                type="email"
                value={user.email}
                disabled
              />
            </div>
            <div>
              <Label htmlFor="new-email" className="mb-2">
                New Email
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isChangingEmail && handleConfirmChangeEmail()}
                placeholder="your.new.email@example.com"
                autoFocus
                disabled={isChangingEmail}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setChangeEmailModalOpen(false)}
              disabled={isChangingEmail}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmChangeEmail}
              disabled={isChangingEmail}
              loading={isChangingEmail}
              loadingText="Sending..."
              className="flex-1"
            >
              Send Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordModalOpen} onOpenChange={(open) => !isChangingPassword && setChangePasswordModalOpen(open)}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below. Must be at least 8 characters with uppercase, lowercase, and number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="mb-2">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isChangingPassword && handleConfirmChangePassword()}
                  placeholder="Enter new password"
                  className="pr-10"
                  autoFocus
                  disabled={isChangingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isChangingPassword}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm-password" className="mb-2">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isChangingPassword && handleConfirmChangePassword()}
                  placeholder="Confirm new password"
                  className="pr-10"
                  disabled={isChangingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isChangingPassword}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setChangePasswordModalOpen(false)}
              disabled={isChangingPassword}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmChangePassword}
              disabled={isChangingPassword}
              loading={isChangingPassword}
              loadingText="Changing..."
              className="flex-1"
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}