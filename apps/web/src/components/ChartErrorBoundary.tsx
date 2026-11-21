import { FC, ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface ChartErrorBoundaryProps {
  children: ReactNode
  chartName?: string
  height?: number
}

const ChartErrorFallback: FC<{ chartName?: string; height?: number }> = ({ chartName, height = 320 }) => (
  <div
    className="flex flex-col items-center justify-center bg-muted/50 rounded-lg border"
    style={{ height: `${height}px` }}
  >
    <AlertTriangle className="w-8 h-8 text-muted-foreground mb-2" />
    <p className="text-sm text-muted-foreground">
      {chartName ? `Unable to load ${chartName}` : 'Unable to load chart'}
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Please try refreshing the page
    </p>
  </div>
)

export const ChartErrorBoundary: FC<ChartErrorBoundaryProps> = ({ 
  children, 
  chartName,
  height = 320 
}) => {
  return (
    <ErrorBoundary
      level="component"
      isolate
      fallback={<ChartErrorFallback chartName={chartName} height={height} />}
      onError={(error) => {
        toast.error(chartName ? `Unable to load ${chartName}` : 'Unable to load chart')
        if (import.meta.env.DEV) {
          console.error(`Chart error${chartName ? ` in ${chartName}` : ''}:`, error)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}