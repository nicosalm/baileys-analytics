import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { Users, DollarSign, TrendingUp, Database, Search, Trash2, AlertTriangle, Settings, LogOut, LayoutDashboard } from 'lucide-react'
import { BRAND } from '@/constants'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'

interface AdminMetrics {
  totalUsers: number
  totalTenants: number
  totalProperties: number
  totalBookings: number
  activeSubscriptions: number
  mrr: number
  recentSignups: number
}

interface AdminUser {
  id: string
  email: string
  created_at: string
  subscription_status?: string
  subscription_exempt: boolean
  ownerrez_connected: boolean
  subscription?: {
    billing_cycle?: string
    status?: string
  }
}

export const Admin = () => {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    verifyAndLoadAdmin()
  }, [])

  const verifyAndLoadAdmin = async () => {
    try {
      setLoading(true)

      // first verify admin status
      const verifyResult = await api.request<{ isAdmin: boolean }>('/admin/verify', { method: 'GET' })

      if (!verifyResult.success || !verifyResult.data?.isAdmin) {
        // silently redirect non-admins
        navigate('/dashboard/overview', { replace: true })
        return
      }

      setIsVerified(true)

      // then load admin data
      const [metricsResult, usersResult] = await Promise.all([
        api.request<{ metrics: AdminMetrics }>('/admin/metrics', { method: 'GET' }),
        api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' })
      ])

      if (metricsResult.success && metricsResult.data) {
        setMetrics(metricsResult.data.metrics)
      }

      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data.users)
      }
    } catch {
      // silently redirect on any error
      navigate('/dashboard/overview', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const handleGrantExemption = async (tenantId: string, currentStatus: boolean) => {
    try {
      const result = await api.request(`/admin/users/${tenantId}/exempt`, {
        method: 'POST',
        body: JSON.stringify({ exempt: !currentStatus })
      })

      if (result.success) {
        // refresh users list
        const usersResult = await api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' })
        if (usersResult.success && usersResult.data) {
          setUsers(usersResult.data.users)
        }
      }
    } catch {
      alert('Failed to update exemption')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteModal.user || deleteConfirmText !== 'DELETE') return

    try {
      setDeleting(true)
      const result = await api.request(`/admin/users/${deleteModal.user.id}`, {
        method: 'DELETE'
      })

      if (result.success) {
        // refresh users list and metrics
        const [metricsResult, usersResult] = await Promise.all([
          api.request<{ metrics: AdminMetrics }>('/admin/metrics', { method: 'GET' }),
          api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' })
        ])

        if (metricsResult.success && metricsResult.data) {
          setMetrics(metricsResult.data.metrics)
        }
        if (usersResult.success && usersResult.data) {
          setUsers(usersResult.data.users)
        }

        setDeleteModal({ open: false, user: null })
        setDeleteConfirmText('')
      } else {
        alert('Failed to delete user')
      }
    } catch {
      alert('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (state.status !== 'authenticated' || loading || !isVerified) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">System management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{state.user?.email}</span>
              <div className="flex items-center gap-2 pl-3 border-l">
                <Link
                  to="/dashboard/overview"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                  title="Back to Dashboard"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
                <Link
                  to="/settings"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-info" />
                <span className="text-2xl font-bold text-foreground">{metrics.totalUsers}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold text-foreground">{metrics.activeSubscriptions}</span>
              </div>
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-purple-fg" />
                <span className="text-2xl font-bold text-foreground">${metrics.mrr}</span>
              </div>
              <p className="text-sm text-muted-foreground">MRR</p>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-orange-fg" />
                <span className="text-2xl font-bold text-foreground">{metrics.totalBookings.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
            </div>
          </div>
        )}

        {/* users table */}
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Users</h2>
              <div className="text-sm text-muted-foreground">{users.length} total users</div>
            </div>

            {/* search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/40">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.subscription_exempt ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success-subtle text-success-fg">
                          Exempt
                        </span>
                      ) : user.subscription?.status === 'active' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success-subtle text-success-fg">
                          Active
                        </span>
                      ) : user.subscription?.status === 'trialing' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-info-subtle text-info-fg">
                          Trial
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.subscription?.billing_cycle === 'yearly' ? 'Yearly' :
                       user.subscription?.billing_cycle === 'monthly' ? 'Monthly' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={user.subscription_exempt ? "destructive" : "outline"}
                          size="xs"
                          onClick={() => handleGrantExemption(user.id, user.subscription_exempt)}
                        >
                          {user.subscription_exempt ? 'Revoke' : 'Grant'} Exemption
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleteModal({ open: true, user })}
                          title="Delete account"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* delete confirmation modal */}
      <AlertDialog open={deleteModal.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteModal({ open: false, user: null })
          setDeleteConfirmText('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger-subtle rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the account for: <strong>{deleteModal.user?.email}</strong>
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="p-3 bg-danger-subtle rounded-lg border border-danger/30">
            <p className="text-sm text-danger-fg">
              This action cannot be undone. All data will be permanently deleted including:
            </p>
            <ul className="text-sm text-danger-fg mt-2 list-disc list-inside">
              <li>All properties, bookings, and guests</li>
              <li>Subscription and billing history</li>
              <li>OwnerRez connection</li>
              <li>Reports and settings</li>
            </ul>
          </div>

          <div>
            <Label className="mb-2">
              Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteConfirmText !== 'DELETE'}
              loading={deleting}
              loadingText="Deleting..."
            >
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}
