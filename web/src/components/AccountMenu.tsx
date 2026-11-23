import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Eye, LogIn, LogOut, MessageSquare, Monitor, Moon, Settings, Shield, Sun, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { api } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SegmentedControl } from '@/components/ui/segmented-control'

const THEME_OPTIONS = [
  { value: 'light', label: <span className="sr-only">Light</span>, icon: Sun },
  { value: 'system', label: <span className="sr-only">System</span>, icon: Monitor },
  { value: 'dark', label: <span className="sr-only">Dark</span>, icon: Moon },
] as const

const getInitials = (companyName: string | null | undefined, email: string | null | undefined) => {
  const words = companyName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length > 0)
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  return (email?.[0] ?? '?').toUpperCase()
}

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// sign-in provider photo first, then gravatar (d=404 makes a missing one fail to load),
// then initials
const AccountAvatar = ({ photoUrl, email, initials }: { photoUrl?: string; email?: string; initials: string }) => {
  const [gravatarUrl, setGravatarUrl] = useState<string>()
  const [failed, setFailed] = useState<string[]>([])

  useEffect(() => {
    if (!email) return
    let cancelled = false
    sha256Hex(email.trim().toLowerCase()).then((hash) => {
      if (!cancelled) setGravatarUrl(`https://gravatar.com/avatar/${hash}?s=72&d=404`)
    })
    return () => {
      cancelled = true
    }
  }, [email])

  const src = [photoUrl, gravatarUrl].find((url): url is string => !!url && !failed.includes(url))

  return (
    <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed((prev) => [...prev, src])}
        />
      ) : (
        initials
      )}
    </span>
  )
}

const verifyAdmin = async () => {
  const result = await api.request<{ isAdmin: boolean }>('/admin/verify', { method: 'GET' })
  return result.success && result.data?.isAdmin === true
}

// shared with the command palette; SWR dedupes the request
export const useIsAdmin = (enabled: boolean) =>
  useSWR(enabled ? '/admin/verify' : null, verifyAdmin, { revalidateOnFocus: false, shouldRetryOnError: false }).data === true

export const AccountMenu = () => {
  const { state, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const user = state.status === 'authenticated' ? state.user : null
  const isDemo = user?.isDemo === true
  const isAdmin = useIsAdmin(!!user && !isDemo)

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="group flex h-9 items-center gap-1.5 rounded-md pr-2 text-muted-foreground transition-colors cursor-pointer outline-none hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {isDemo ? (
            <span className="inline-flex h-9 items-center gap-1.5 pl-3 text-sm font-medium">
              <Eye className="size-4" />
              Demo
            </span>
          ) : (
            <AccountAvatar
              photoUrl={user.user_metadata?.avatar_url}
              email={user.email}
              initials={getInitials(user.companyName, user.email)}
            />
          )}
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{isDemo ? 'Demo' : user.companyName || 'Account'}</p>
          {isDemo ? (
            <p className="truncate text-xs text-muted-foreground">Sample data from {user.companyName ?? 'a demo portfolio'}</p>
          ) : (
            user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isDemo ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/signup">
                <UserPlus />
                Create an account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/login">
                <LogIn />
                Sign in
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/admin">
                  <Shield />
                  Admin
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuItem asChild>
          <a href="mailto:support@baileysanalytics.com">
            <MessageSquare />
            Send feedback
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <span className="text-sm text-foreground">Theme</span>
          <SegmentedControl label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>

        {/* a demo has no account to log out of; signing in or up ends it */}
        {!isDemo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
