import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  inline?: boolean
}

export const LoadingState = ({ message, size = 'md', fullScreen = false, inline = false }: LoadingStateProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
      {message && <p className={`text-muted-foreground ${textSizes[size]}`}>{message}</p>}
    </div>
  )

  if (fullScreen) {
    return <div className="flex items-center justify-center h-screen">{content}</div>
  }

  if (inline) {
    return (
      <div className="inline-flex items-center gap-2">
        <Loader2 className={`animate-spin text-current ${sizeClasses[size]}`} />
        {message && <span className={`text-current ${textSizes[size]}`}>{message}</span>}
      </div>
    )
  }

  return <div className="flex items-center justify-center py-12">{content}</div>
}
