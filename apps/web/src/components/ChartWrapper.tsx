import type React from 'react'
import { cn } from '@/lib/utils'
import { Loader2, AlertCircle, BarChart3, Info } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'

export interface ChartWrapperProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  loading?: boolean
  error?: string | null
  noData?: boolean
  noDataMessage?: string
  height?: number | string
  className?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  controls?: React.ReactNode
  tooltip?: string
  info?: string
  responsive?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  subtitle,
  children,
  loading = false,
  error = null,
  noData = false,
  noDataMessage = 'No data available',
  height = 300,
  className,
  icon: Icon = BarChart3,
  actions,
  controls,
  tooltip,
  info,
  responsive = true,
  padding = 'md',
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const heightValue = typeof height === 'number' ? `${height}px` : height
  const baseCard = cn('bg-card rounded-lg shadow-sm border border-border', paddingClasses[padding], className)

  if (loading) {
    return (
      <div className={baseCard}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ height: heightValue }}>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={baseCard}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-danger" style={{ height: heightValue }}>
          <AlertCircle className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Error loading chart</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (noData) {
    return (
      <div className={baseCard}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          {actions}
        </div>
        {controls && <div className="mb-4">{controls}</div>}
        <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: heightValue }}>
          <EmptyQuadrants className="w-12 h-12 mb-2" />
          <p className="text-sm font-medium">{noDataMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={baseCard} title={tooltip}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Icon className="w-5 h-5 mr-2 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {controls && <div className="mb-4">{controls}</div>}

      {info && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <Info className="w-4 h-4 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">{info}</div>
          </div>
        </div>
      )}

      <ChartErrorBoundary chartName={title} height={typeof height === 'number' ? height : 300}>
        {responsive ? (
          <div style={{ height: heightValue }}>
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: heightValue }} className="overflow-x-auto">
            {children}
          </div>
        )}
      </ChartErrorBoundary>
    </div>
  )
}
