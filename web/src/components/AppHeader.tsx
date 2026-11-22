import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { BRAND } from '@/constants'
import { Logo } from '@/components/Logo'
import { AccountMenu } from '@/components/AccountMenu'
import { CommandPalette } from '@/components/CommandPalette'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  // page controls rendered before the account menu
  children?: ReactNode
  // primary navigation, shown inline from md up
  nav?: ReactNode
  // trailing control after the account menu, such as the mobile menu button
  menu?: ReactNode
  // defaults to the company name, then the product name
  title?: string
  // null hides the caption; defaults to the product name when the title is something else
  subtitle?: string | null
}

// the customer's company leads; Baileys is the caption under it
export const AppHeader = ({ children, nav, menu, title, subtitle }: AppHeaderProps) => {
  const { state } = useAuth()
  const companyName = state.status === 'authenticated' ? state.user.companyName : null
  const heading = title ?? companyName ?? BRAND.name
  const caption = subtitle !== undefined ? subtitle : heading === BRAND.name ? null : BRAND.name

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
        <Link to="/dashboard/overview" className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
          <Logo />
          {/* with inline nav the wordmark only fits from lg up */}
          <div className={cn('min-w-0', nav && 'md:hidden lg:block')}>
            <p className="truncate text-lg font-semibold leading-tight text-foreground sm:text-xl">{heading}</p>
            {caption && <p className="hidden truncate text-xs text-muted-foreground sm:block">{caption}</p>}
          </div>
        </Link>
        {nav && <div className="hidden h-full min-w-0 flex-1 items-stretch md:flex md:ml-4 lg:ml-8">{nav}</div>}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <CommandPalette />
          {children}
          <AccountMenu />
          {menu}
        </div>
      </div>
    </header>
  )
}
