import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense, type ComponentType, useCallback } from 'react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import { Calendar, CreditCard, Link2, Lock, MessageSquare, ArrowLeft, Eye, EyeOff, Receipt, Target, Layers } from 'lucide-react'
import { Footer } from '@/components/Footer'
import { AppHeader } from '@/components/AppHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SeasonManagementPanel = lazy(() =>
  import('@/components/settings/SeasonManagementPanel').then((m) => ({ default: m.SeasonManagementPanel })),
)

const IntegrationsTab = lazy(() => import('@/components/settings/IntegrationsTab').then((m) => ({ default: m.IntegrationsTab })))

const BillingTab = lazy(() => import('@/components/settings/BillingTab').then((m) => ({ default: m.BillingTab })))

const AccountTab = lazy(() => import('@/components/settings/AccountTab').then((m) => ({ default: m.AccountTab })))

const ExpenseManagementPanel = lazy(() =>
  import('@/components/settings/ExpenseManagementPanel').then((m) => ({ default: m.ExpenseManagementPanel })),
)

const GoalManagementPanel = lazy(() =>
  import('@/components/settings/GoalManagementPanel').then((m) => ({ default: m.GoalManagementPanel })),
)

const PropertyGroupManagementPanel = lazy(() =>
  import('@/components/settings/PropertyGroupManagementPanel').then((m) => ({ default: m.PropertyGroupManagementPanel })),
)

type SettingsTab = 'account' | 'goals' | 'integrations' | 'billing' | 'seasons' | 'expenses' | 'property-groups'

const tabConfig: { id: SettingsTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  {
    id: 'account',
    label: 'Account',
    icon: Lock,
  },
  {
    id: 'goals',
    label: 'Goals',
    icon: Target,
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: Receipt,
  },
  {
    id: 'property-groups',
    label: 'Property Groups',
    icon: Layers,
  },
  {
    id: 'seasons',
    label: 'Seasons',
    icon: Calendar,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Link2,
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
  },
]

export const Settings = () => {
  const { state, updateEmail, updatePassword } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab')
    return tabConfig.some(({ id }) => id === tab) ? (tab as SettingsTab) : 'account'
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

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout !== 'success' && checkout !== 'cancel') return
    addToast(checkout === 'success' ? 'success' : 'info', checkout === 'success' ? 'Subscription active' : 'Checkout canceled')
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('checkout')
    setSearchParams(newParams, { replace: true })
  }, [])

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      setActiveTab(tab)
      setSearchParams({ tab })
    },
    [setSearchParams],
  )

  const handleChangePassword = useCallback(() => {
    setChangePasswordModalOpen(true)
    setNewPassword('')
    setConfirmNewPassword('')
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }, [])

  const handleConfirmChangePassword = async () => {
    const trimmedPassword = newPassword.trim()
    const trimmedConfirm = confirmNewPassword.trim()

    if (!trimmedPassword) {
      addToast('error', 'Enter a new password')
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
        addToast('success', 'Password changed')
        setChangePasswordModalOpen(false)
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        addToast('error', 'Failed to change password')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeEmail = () => {
    setNewEmail('')
    setChangeEmailModalOpen(true)
  }

  const handleConfirmChangeEmail = async () => {
    const trimmedEmail = newEmail.trim()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      addToast('error', 'Enter a valid email address')
      return
    }

    if (state.status === 'authenticated' && trimmedEmail.toLowerCase() === state.user.email?.toLowerCase()) {
      addToast('error', 'New email must be different from current email')
      return
    }

    setIsChangingEmail(true)
    try {
      const result = await updateEmail(trimmedEmail)
      if (result) {
        addToast('success', 'Confirmation link sent to the new address')
        setChangeEmailModalOpen(false)
        setNewEmail('')
      } else {
        addToast('error', 'Failed to update email')
      }
    } catch {
      addToast('error', 'Failed to update email')
    } finally {
      setIsChangingEmail(false)
    }
  }

  if (state.status === 'loading') {
    return <LoadingState />
  }

  if (state.status !== 'authenticated') {
    return null
  }

  const { user } = state

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/dashboard/overview">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
      </AppHeader>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full">
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* mobile tab bar */}
        <div className="md:hidden mb-6">
          <nav className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {tabConfig.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => handleTabChange(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex gap-6">
          {/* desktop sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <nav className="space-y-1 bg-card/50 backdrop-blur-sm rounded-lg p-2 border border-border">
              {tabConfig.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => handleTabChange(id)}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>

            <a
              href="mailto:support@baileysanalytics.com"
              className="mt-3 w-full flex items-center gap-3 px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Send feedback
            </a>
          </div>

          <div className="flex-1 min-w-0">
            <Suspense fallback={<LoadingState />}>
              {activeTab === 'account' && (
                <AccountTab
                  onChangeEmail={!user.isOAuthUser ? handleChangeEmail : undefined}
                  onChangePassword={!user.isOAuthUser ? handleChangePassword : undefined}
                />
              )}
              {activeTab === 'goals' && <GoalManagementPanel />}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'billing' && <BillingTab />}
              {activeTab === 'expenses' && <ExpenseManagementPanel />}
              {activeTab === 'property-groups' && <PropertyGroupManagementPanel />}
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
            <DialogDescription>The change takes effect once you open the link sent to the new address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-email" className="mb-2">
                Current Email
              </Label>
              <Input id="current-email" type="email" value={user.email} disabled />
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
                placeholder="name@example.com"
                autoFocus
                disabled={isChangingEmail}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => setChangeEmailModalOpen(false)} disabled={isChangingEmail} className="flex-1">
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
            <DialogDescription>At least 8 characters, with an uppercase letter, a lowercase letter and a number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="mb-2">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
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
                  type={showConfirmPassword ? 'text' : 'password'}
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
            <Button variant="outline" onClick={() => setChangePasswordModalOpen(false)} disabled={isChangingPassword} className="flex-1">
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
