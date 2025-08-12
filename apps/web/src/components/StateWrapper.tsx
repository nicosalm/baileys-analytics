import React from 'react'
import { cn } from '@baileys/utils'
import { Loader2, AlertCircle, Database, RefreshCw } from 'lucide-react'
import { LoadingState } from './LoadingState'

export interface StateWrapperProps {
  // State flags
  loading?: boolean
  error?: string | Error | null
  empty?: boolean
  
  // Messages
  loadingMessage?: string
  errorMessage?: string
  emptyMessage?: string
  emptySubMessage?: string
  
  // Icons
  emptyIcon?: React.ReactNode
  
  // Actions
  onRetry?: () => void
  retryLabel?: string
  
  // Content
  children: React.ReactNode
  
  // Styling
  className?: string
  minHeight?: number | string
  centered?: boolean
  
  // Loading style
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
  skeletonRows = 3
}) => {
  const heightValue = typeof minHeight === 'number' ? `${minHeight}px` : minHeight
  
  const containerClasses = cn(
    centered && 'flex flex-col items-center justify-center',
    className
  )

  // Handle loading state
  if (loading) {
    if (loadingStyle === 'spinner') {
      return (
        <div className={containerClasses} style={{ minHeight: heightValue }}>
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          {loadingMessage && (
            <p className="text-sm text-gray-600 mt-2">{loadingMessage}</p>
          )}
        </div>
      )
    }
    
    if (loadingStyle === 'skeleton') {
      return (
        <div className={className} style={{ minHeight: heightValue }}>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="animate-pulse mb-4">
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )
    }
    
    // Default to LoadingState component
    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        <LoadingState message={loadingMessage} />
      </div>
    )
  }

  // Handle error state
  if (error) {
    const errorMsg = errorMessage || 
      (error instanceof Error ? error.message : String(error))
    
    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-900 font-medium mb-1">Something went wrong</p>
        <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {retryLabel}
          </button>
        )}
      </div>
    )
  }

  // Handle empty state
  if (empty) {
    return (
      <div className={containerClasses} style={{ minHeight: heightValue }}>
        {emptyIcon || <Database className="w-12 h-12 text-gray-400 mb-4" />}
        <p className="text-gray-900 font-medium mb-1">{emptyMessage}</p>
        {emptySubMessage && (
          <p className="text-sm text-gray-600">{emptySubMessage}</p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {retryLabel}
          </button>
        )}
      </div>
    )
  }

  // Render children when no special state
  return <>{children}</>
}

// Card wrapper with state handling
export const CardStateWrapper: React.FC<StateWrapperProps & {
  title?: string
  icon?: React.ComponentType<{ className?: string }>
}> = ({
  title,
  icon: Icon,
  ...props
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {title && (
        <div className="flex items-center mb-4">
          {Icon && <Icon className="w-5 h-5 mr-2 text-gray-600" />}
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
      )}
      <StateWrapper {...props} />
    </div>
  )
}

// Section wrapper with state handling
export const SectionStateWrapper: React.FC<StateWrapperProps & {
  title: string
  description?: string
}> = ({
  title,
  description,
  ...props
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && (
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        )}
      </div>
      <StateWrapper {...props} />
    </div>
  )
}