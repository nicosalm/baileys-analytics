import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  // render children edge to edge, for lists that draw their own rows
  flush?: boolean
  tone?: 'default' | 'danger'
  className?: string
  children?: ReactNode
}

export const SettingsSection = ({
  title,
  description,
  action,
  flush = false,
  tone = 'default',
  className,
  children,
}: SettingsSectionProps) => (
  <section
    className={cn(
      'bg-card rounded-lg shadow-sm border overflow-hidden',
      tone === 'danger' ? 'border-danger/30' : 'border-border',
      className,
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <h3 className={cn('text-lg font-semibold', tone === 'danger' ? 'text-danger-fg' : 'text-foreground')}>{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
    {children && <div className={flush ? 'border-t border-border' : 'px-4 pb-4 sm:px-6 sm:pb-6'}>{children}</div>}
  </section>
)

interface SettingsRowProps {
  label: ReactNode
  children: ReactNode
  className?: string
}

export const SettingsRow = ({ label, children, className }: SettingsRowProps) => (
  <div
    className={cn(
      'flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3 border-b border-border/60 first:pt-0 last:border-0 last:pb-0',
      className,
    )}
  >
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">{children}</div>
  </div>
)

export const SettingsError = ({ message }: { message: string }) => (
  <div className="bg-danger-subtle border border-danger/30 rounded-lg p-4">
    <p className="text-sm text-danger-fg">{message}</p>
  </div>
)
