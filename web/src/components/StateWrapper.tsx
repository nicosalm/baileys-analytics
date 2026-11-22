import type React from 'react'
import { cn } from '@/lib/utils'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { LoadingState } from './LoadingState'
import { Button } from '@/components/ui/button'
import { EmptyMark } from '@/components/EmptyMark'

export interface StateWrapperProps {
  loading?: boolean
  error?: string | Error | null
  empty?: boolean
  loadingMessage?: string
  errorMessage?: string
  emptyMessage?: string
  emptySubMessage?: string
  emptyIcon?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  children: React.ReactNode
  className?: string
  minHeight?: number | string
  centered?: boolean
  loadingStyle?: 'spinner' | 'skeleton' | 'component'
  skeletonRows?: number
}

export const StateWrapper: React.FC<StateWrapperProps> = ({
  loading = false,
  error = null,
  empty = false,
  loadingMessage = 'Loading...',
  errorMessage,
  emptyMessage = 'No data available',
  emptySubMessage,
  emptyIcon,
  onRetry,
  retryLabel = 'Retry',
  children,
  className,
  minHeight = 200,
  centered = true,
  loadingStyle = 'component',
  skeletonRows = 3,
}) => {
  const heightValue = typeof minHeight === 'number' ? `${minHeight}px` : minHeight

  const containerClasses = cn(centered && 'flex flex-col items-center justify-center', className)

  if (loading) {
    if (loadingStyle === 'spinner') {
      return (
        <div className={containerClasses} style={{ minHeight: heightValue }}>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/70" />
          {loadingMessage && <p className="text-sm text-muted-foreground mt-2">{loadingMessage}</p>}
        </div>
      )
    }

    if (loadingStyle === 'skeleton') {
      return (
        <div className={className} style={{ minHeight: heightValue }}>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="animate-pulse mb-4">
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        <LoadingState message={loadingMessage} />
      </div>
    )
  }

  if (error) {
    const errorMsg = errorMessage || (error instanceof Error ? error.message : String(error))

    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        <AlertCircle className="w-12 h-12 text-danger mb-4" />
        <p className="text-foreground font-medium mb-1">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        {emptyIcon || <EmptyMark className="w-12 h-12 mb-2" />}
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        {emptySubMessage && <p className="text-xs text-muted-foreground/70 mt-1">{emptySubMessage}</p>}
        {onRetry && (
          <Button onClick={onRetry} className="mt-4">
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    )
  }

  return <>{children}</>
}
