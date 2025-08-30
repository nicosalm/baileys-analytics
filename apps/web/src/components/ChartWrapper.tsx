import React from 'react'
import { cn } from '@baileys/utils'
import { Loader2, AlertCircle, BarChart3, Info } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'
import { ChartErrorBoundary } from './ChartErrorBoundary'

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
  tooltip,
  info,
  responsive = true,
  padding = 'md'
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  const heightValue = typeof height === 'number' ? `${height}px` : height

  if (loading) {
    return (
      <div className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        paddingClasses[padding],
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
        </div>
        <div 
          className="flex items-center justify-center"
          style={{ height: heightValue }}
        >
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        paddingClasses[padding],
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
        </div>
        <div 
          className="flex flex-col items-center justify-center text-red-500"
          style={{ height: heightValue }}
        >
          <AlertCircle className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Error loading chart</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (noData) {
    return (
      <div className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        paddingClasses[padding],
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          {actions}
        </div>
        <div 
          className="flex flex-col items-center justify-center text-gray-500"
          style={{ height: heightValue }}
        >
          <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm font-medium">{noDataMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        paddingClasses[padding],
        className
      )}
      title={tooltip}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Icon className="w-5 h-5 mr-2 text-gray-600" />
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            {subtitle && (
              <p className="text-sm text-gray-600">{subtitle}</p>
            )}
          </div>
        </div>
        {actions}
      </div>

      {/* Info banner if provided */}
      {info && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">{info}</div>
          </div>
        </div>
      )}

      {/* Chart container */}
      <ChartErrorBoundary chartName={title} height={typeof height === 'number' ? height : 300}>
        {responsive ? (
          <div style={{ height: heightValue }}>
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: heightValue }}>
            {children}
          </div>
        )}
      </ChartErrorBoundary>
    </div>
  )
}

export const MiniChartWrapper: React.FC<{
  children: React.ReactNode
  height?: number
  loading?: boolean
  className?: string
}> = ({ 
  children, 
  height = 60, 
  loading = false,
  className 
}) => {
  if (loading) {
    return (
      <div 
        className={cn("flex items-center justify-center", className)}
        style={{ height: `${height}px` }}
      >
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <ChartErrorBoundary height={height}>
      <div style={{ height: `${height}px` }} className={className}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </ChartErrorBoundary>
  )
}