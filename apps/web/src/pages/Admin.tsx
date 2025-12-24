import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { Users, DollarSign, TrendingUp, Database, Shield, Search, Trash2, AlertTriangle, X, Settings, LogOut, LayoutDashboard } from 'lucide-react'
import { BRAND } from '@/constants'
import { Footer } from '@/components/Footer'

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
  company_name?: string
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
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (state.status !== 'authenticated' || loading || !isVerified) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className={`w-9 h-9 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
                <p className="text-xs text-gray-500 -mt-0.5">System management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:inline">{state.user?.email}</span>
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                <Link
                  to="/dashboard/overview"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                  title="Back to Dashboard"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
                <Link
                  to="/settings"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">{metrics.totalUsers}</span>
              </div>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-gray-900">{metrics.activeSubscriptions}</span>
              </div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span className="text-2xl font-bold text-gray-900">${metrics.mrr}</span>
              </div>
              <p className="text-sm text-gray-600">MRR</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-orange-600" />
                <span className="text-2xl font-bold text-gray-900">{metrics.totalBookings.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Total Bookings</p>
            </div>
          </div>
        )}

        {/* users table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Users</h2>
              <div className="text-sm text-gray-500">{users.length} total users</div>
            </div>

            {/* search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      {user.company_name && (
                        <div className="text-sm text-gray-500">{user.company_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.subscription_exempt ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Exempt
                        </span>
                      ) : user.subscription?.status === 'active' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : user.subscription?.status === 'trialing' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Trial
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.subscription?.billing_cycle === 'yearly' ? 'Yearly' :
                       user.subscription?.billing_cycle === 'monthly' ? 'Monthly' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleGrantExemption(user.id, user.subscription_exempt)}
                          className={`px-3 py-1 text-xs font-medium rounded-md ${
                            user.subscription_exempt
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {user.subscription_exempt ? 'Revoke' : 'Grant'} Exemption
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, user })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      {deleteModal.open && deleteModal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This will permanently delete the account for:
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-2">{deleteModal.user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setDeleteModal({ open: false, user: null })
                    setDeleteConfirmText('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  This action cannot be undone. All data will be permanently deleted including:
                </p>
                <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                  <li>All properties, bookings, and guests</li>
                  <li>Subscription and billing history</li>
                  <li>OwnerRez connection</li>
                  <li>Reports and settings</li>
                </ul>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="DELETE"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModal({ open: false, user: null })
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
