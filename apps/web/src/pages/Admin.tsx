import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import {
  Users, DollarSign, TrendingUp, Search, Trash2, AlertTriangle,
  Settings, LogOut, LayoutDashboard, RefreshCw, ChevronDown,
  Shield, Link2, Link2Off, AlertCircle, UserPlus, Building2, CalendarDays,
  ExternalLink, Megaphone, Plus, Pencil, Eye, EyeOff
} from 'lucide-react'
import { LogoCube } from '@/components/LogoCube'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel
} from '@/components/ui/alert-dialog'

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
  company_name?: string | null
  created_at: string
  subscription_status?: string
  subscription_exempt: boolean
  ownerrez_connected: boolean
  first_subscription_at?: string
  subscription?: {
    billing_cycle?: string
    status?: string
    trial_end?: string
    current_period_end?: string
  }
}

interface UserDetail {
  tenant: Record<string, unknown>
  subscription: { current_period_end?: string; [key: string]: unknown } | null
  stats: { properties: number; bookings: number }
  syncStatus: Array<{
    sync_type: string
    last_sync: string
    status: string
    records_synced: number
  }>
}

interface Announcement {
  id: string
  title: string
  body: string
  author: string
  published: boolean
  created_at: string
  updated_at: string
}

interface WebhookError {
  id: string
  created_at: string
  event_type: string
  processing_error: string
  tenant_id: string
}

const StatusBadge = ({ status, exempt }: { status?: string; exempt: boolean }) => {
  if (exempt) return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-subtle text-purple-fg">Exempt</span>
  )
  if (status === 'active') return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success-subtle text-success-fg">Active</span>
  )
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">Inactive</span>
  )
}

const TimeAgo = ({ date }: { date: string }) => {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  let text: string
  if (minutes < 1) text = 'just now'
  else if (minutes < 60) text = `${minutes}m ago`
  else if (hours < 24) text = `${hours}h ago`
  else if (days < 30) text = `${days}d ago`
  else text = new Date(date).toLocaleDateString()

  return <span title={new Date(date).toLocaleString()}>{text}</span>
}

const UserDetailPanel = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.request<UserDetail>(`/admin/users/${userId}`, { method: 'GET' })
      .then(res => { if (res.success && res.data) setDetail(res.data) })
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  if (!detail) return <div className="p-4 text-sm text-muted-foreground">Failed to load details</div>

  return (
    <div className="bg-muted/30 border-t px-6 py-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Properties</p>
          <p className="font-medium text-foreground">{detail.stats.properties}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Bookings</p>
          <p className="font-medium text-foreground">{detail.stats.bookings.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Period ends</p>
          <p className="font-medium text-foreground">
            {detail.subscription?.current_period_end
              ? new Date(detail.subscription.current_period_end).toLocaleDateString()
              : '-'}
          </p>
        </div>
      </div>

      {detail.syncStatus && detail.syncStatus.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Sync status</p>
          <div className="flex flex-wrap gap-3">
            {detail.syncStatus.map(s => (
              <div key={s.sync_type} className="flex items-center gap-2 text-xs bg-card rounded-md px-3 py-1.5 border">
                <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'success' ? 'bg-success' : s.status === 'partial' ? 'bg-warning' : 'bg-danger'}`} />
                <span className="text-foreground font-medium">{s.sync_type}</span>
                <span className="text-muted-foreground">{s.records_synced} records</span>
                <span className="text-muted-foreground"><TimeAgo date={s.last_sync} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          Close
        </Button>
      </div>
    </div>
  )
}

export const Admin = () => {
  const { state, logout } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [errors, setErrors] = useState<WebhookError[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementForm, setAnnouncementForm] = useState<{ open: boolean; editing: Announcement | null }>({ open: false, editing: null })
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formPublished, setFormPublished] = useState(false)
  const [formAuthor, setFormAuthor] = useState('Baileys Team')
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [togglingAnnouncement, setTogglingAnnouncement] = useState<string | null>(null)
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<string | null>(null)
  const [confirmDeleteAnnouncement, setConfirmDeleteAnnouncement] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [metricsResult, usersResult, errorsResult, announcementsResult] = await Promise.all([
      api.request<{ metrics: AdminMetrics }>('/admin/metrics', { method: 'GET' }),
      api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' }),
      api.request<{ errors: WebhookError[] }>('/admin/errors', { method: 'GET' }),
      api.request<{ announcements: Announcement[] }>('/announcements/all', { method: 'GET' }),
    ])

    if (metricsResult.success && metricsResult.data) setMetrics(metricsResult.data.metrics)
    if (usersResult.success && usersResult.data) setUsers(usersResult.data.users)
    if (errorsResult.success && errorsResult.data) setErrors(errorsResult.data.errors)
    if (announcementsResult.success && announcementsResult.data) setAnnouncements(announcementsResult.data.announcements)
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        const verifyResult = await api.request<{ isAdmin: boolean }>('/admin/verify', { method: 'GET' })
        if (!verifyResult.success || !verifyResult.data?.isAdmin) {
          navigate('/dashboard/overview', { replace: true })
          return
        }
        setIsVerified(true)
        await loadData()
      } catch {
        navigate('/dashboard/overview', { replace: true })
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleGrantExemption = async (tenantId: string, currentStatus: boolean) => {
    const result = await api.request(`/admin/users/${tenantId}/exempt`, {
      method: 'POST',
      body: JSON.stringify({ exempt: !currentStatus })
    })
    if (result.success) {
      const usersResult = await api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' })
      if (usersResult.success && usersResult.data) setUsers(usersResult.data.users)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteModal.user || deleteConfirmText !== 'DELETE') return
    try {
      setDeleting(true)
      const result = await api.request(`/admin/users/${deleteModal.user.id}`, { method: 'DELETE' })
      if (result.success) {
        await loadData()
        setDeleteModal({ open: false, user: null })
        setDeleteConfirmText('')
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleImpersonate = async (tenantId: string) => {
    const result = await api.request<{ url: string }>(`/admin/users/${tenantId}/impersonate`, { method: 'POST' })
    if (result.success && result.data?.url) {
      window.open(result.data.url, '_blank')
    }
  }

  const openAnnouncementForm = (announcement?: Announcement) => {
    if (announcement) {
      setFormTitle(announcement.title)
      setFormBody(announcement.body)
      setFormAuthor(announcement.author || 'Baileys Team')
      setFormPublished(announcement.published)
      setAnnouncementForm({ open: true, editing: announcement })
    } else {
      setFormTitle('')
      setFormBody('')
      setFormAuthor('Baileys Team')
      setFormPublished(false)
      setAnnouncementForm({ open: true, editing: null })
    }
  }

  const refreshAnnouncements = async () => {
    const res = await api.request<{ announcements: Announcement[] }>('/announcements/all', { method: 'GET' })
    if (res.success && res.data) setAnnouncements(res.data.announcements)
  }

  const handleSaveAnnouncement = async () => {
    if (!formTitle.trim() || !formBody.trim()) return
    setSavingAnnouncement(true)
    try {
      const payload = { title: formTitle, body: formBody, author: formAuthor, published: formPublished }
      const res = announcementForm.editing
        ? await api.request(`/announcements/${announcementForm.editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api.request('/announcements', { method: 'POST', body: JSON.stringify(payload) })
      if (!res.success) throw new Error()
      setAnnouncementForm({ open: false, editing: null })
      await refreshAnnouncements()
      addToast('success', announcementForm.editing ? 'Announcement updated' : 'Announcement created')
    } catch {
      addToast('error', 'Failed to save announcement')
    } finally {
      setSavingAnnouncement(false)
    }
  }

  const handleTogglePublished = async (a: Announcement) => {
    const newState = !a.published
    setTogglingAnnouncement(a.id)
    setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, published: newState } : x))
    try {
      const res = await api.request(`/announcements/${a.id}`, {
        method: 'PUT',
        body: JSON.stringify({ published: newState })
      })
      if (!res.success) throw new Error()
      addToast('success', newState ? 'Announcement published' : 'Announcement hidden')
    } catch {
      setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, published: a.published } : x))
      addToast('error', 'Failed to update announcement')
    } finally {
      setTogglingAnnouncement(null)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    setDeletingAnnouncement(id)
    const prev = announcements
    setAnnouncements(list => list.filter(a => a.id !== id))
    try {
      const res = await api.request(`/announcements/${id}`, { method: 'DELETE' })
      if (!res.success) throw new Error()
      addToast('success', 'Announcement deleted')
      setConfirmDeleteAnnouncement(null)
    } catch {
      setAnnouncements(prev)
      addToast('error', 'Failed to delete announcement')
    } finally {
      setDeletingAnnouncement(null)
    }
  }

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase()
    return user.email?.toLowerCase().includes(term) ||
           user.company_name?.toLowerCase().includes(term)
  })

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
            <Link to="/dashboard" className="flex items-center">
              <LogoCube />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">System management</p>
              </div>
            </Link>
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

      <div className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full">
        {/* top bar with refresh */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* metrics grid — 2 rows */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Users</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{metrics.totalUsers}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Active Subs</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{metrics.activeSubscriptions}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">MRR</span>
              </div>
              <span className="text-2xl font-bold text-foreground">${metrics.mrr}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Signups (7d)</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{metrics.recentSignups}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Properties</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{metrics.totalProperties}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Bookings</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{metrics.totalBookings.toLocaleString()}</span>
            </div>

            <div className="bg-card rounded-lg shadow-sm border p-5 col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-danger" />
                <span className="text-xs text-muted-foreground">Recent Errors</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-foreground">{errors.length}</span>
                {errors.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowErrors(!showErrors)}
                    className="text-xs"
                  >
                    {showErrors ? 'Hide' : 'View'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* error log (collapsible) */}
        {showErrors && errors.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border mb-6">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-foreground">Webhook Errors</h3>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {errors.slice(0, 20).map(err => (
                <div key={err.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{err.event_type}</span>
                    <span className="text-xs text-muted-foreground"><TimeAgo date={err.created_at} /></span>
                  </div>
                  <p className="text-xs text-danger-fg font-mono truncate">{err.processing_error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* users table */}
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="p-4 md:p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Users</h2>
              <div className="text-sm text-muted-foreground">{filteredUsers.length} of {users.length}</div>
            </div>
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
            <table className="w-full table-fixed">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="w-[25%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="w-[15%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Company</th>
                  <th className="w-[10%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="w-[8%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Plan</th>
                  <th className="w-[8%] px-5 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">OwnerRez</th>
                  <th className="w-[12%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="w-[22%] px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td colSpan={7} className="p-0">
                      <table className="w-full table-fixed">
                        <tbody>
                          <tr className="hover:bg-muted/30 transition-colors">
                            <td className="w-[25%] px-5 py-3">
                              <button
                                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer truncate max-w-full"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                                <span className="truncate">{user.email}</span>
                              </button>
                            </td>
                            <td className="w-[15%] px-5 py-3 hidden lg:table-cell text-sm text-muted-foreground truncate">
                              {user.company_name || <span className="text-muted-foreground/50">-</span>}
                            </td>
                            <td className="w-[10%] px-5 py-3">
                              <StatusBadge status={user.subscription?.status} exempt={user.subscription_exempt} />
                            </td>
                            <td className="w-[8%] px-5 py-3 hidden md:table-cell text-sm text-muted-foreground">
                              {user.subscription?.billing_cycle === 'yearly' ? 'Yearly' :
                               user.subscription?.billing_cycle === 'monthly' ? 'Monthly' : '-'}
                            </td>
                            <td className="w-[8%] px-5 py-3 hidden md:table-cell text-center">
                              {user.ownerrez_connected ? (
                                <span title="Connected"><Link2 className="w-4 h-4 text-success inline-block" /></span>
                              ) : (
                                <span title="Not connected"><Link2Off className="w-4 h-4 text-muted-foreground inline-block" /></span>
                              )}
                            </td>
                            <td className="w-[12%] px-5 py-3 hidden lg:table-cell text-sm text-muted-foreground tabular-nums">
                              {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                            </td>
                            <td className="w-[22%] px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); handleImpersonate(user.id) }}
                                  title="Login as user"
                                  className="text-muted-foreground hover:text-info"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant={user.subscription_exempt ? "destructive" : "outline"}
                                  size="xs"
                                  onClick={(e) => { e.stopPropagation(); handleGrantExemption(user.id, user.subscription_exempt) }}
                                  title={user.subscription_exempt ? 'Revoke exemption' : 'Grant exemption'}
                                >
                                  <Shield className="w-3.5 h-3.5 md:mr-1" />
                                  <span className="hidden md:inline">{user.subscription_exempt ? 'Revoke' : 'Exempt'}</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, user }) }}
                                  title="Delete account"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedUser === user.id && (
                            <tr>
                              <td colSpan={7}>
                                <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      {searchTerm ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* announcements */}
        <div className="bg-card rounded-lg shadow-sm border mt-6">
          <div className="p-4 md:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              Announcements
            </h2>
            <Button size="sm" onClick={() => openAnnouncementForm()}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>

          {announcementForm.open && (
            <div className="p-4 md:p-6 border-b bg-muted/30 space-y-3">
              <Input
                placeholder="Title"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
              />
              <Input
                placeholder="Author (e.g. Baileys Team, Nico)"
                value={formAuthor}
                onChange={e => setFormAuthor(e.target.value)}
              />
              <Textarea
                placeholder="Body (plain text, line breaks preserved)"
                value={formBody}
                onChange={e => setFormBody(e.target.value)}
                rows={4}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPublished}
                    onChange={e => setFormPublished(e.target.checked)}
                    className="rounded"
                  />
                  Publish immediately
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAnnouncementForm({ open: false, editing: null })}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAnnouncement}
                    disabled={!formTitle.trim() || !formBody.trim()}
                    loading={savingAnnouncement}
                    loadingText="Saving..."
                  >
                    {announcementForm.editing ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="divide-y">
            {announcements.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No announcements yet
              </div>
            ) : announcements.map(a => (
              <div key={a.id} className={`px-5 py-4 flex items-start justify-between gap-4 transition-opacity ${deletingAnnouncement === a.id ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{a.title}</h3>
                    {a.published ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-success-subtle text-success-fg">Live</span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground">Draft</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {a.author && <> &middot; {a.author}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleTogglePublished(a)}
                    title={a.published ? 'Unpublish' : 'Publish'}
                    disabled={togglingAnnouncement === a.id}
                    className={togglingAnnouncement === a.id ? 'opacity-50' : ''}
                  >
                    {a.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openAnnouncementForm(a)}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  {confirmDeleteAnnouncement === a.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        disabled={deletingAnnouncement === a.id}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmDeleteAnnouncement(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setConfirmDeleteAnnouncement(a.id)}
                      title="Delete"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
              <li>All settings and preferences</li>
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
