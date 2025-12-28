import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes } from 'react'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
}

export const LoadingButton = ({ 
  loading = false,
  loadingText,
  children,
  disabled,
  className = '',
  ...props 
}: LoadingButtonProps) => {
  return (
    <button
      disabled={loading || disabled}
      className={`${className} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText && <span>{loadingText}</span>}
        </span>
      ) : (
        children
      )}
    </button>
  )
}