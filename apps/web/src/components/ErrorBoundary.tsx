import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null
  private previousResetKeys: Array<string | number> = []

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    }

    if (props.resetKeys) {
      this.previousResetKeys = props.resetKeys
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props

    if (import.meta.env.DEV) {
      console.error('Error caught by ErrorBoundary:', error, errorInfo)
    }

    if (onError) {
      onError(error, errorInfo)
    }

    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }))

    if (this.props.level === 'component' && this.state.errorCount < 3) {
      this.resetTimeoutId = setTimeout(() => {
        this.resetErrorBoundary()
      }, 10000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props
    const { hasError } = this.state

    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== this.previousResetKeys[idx])

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
        this.previousResetKeys = resetKeys
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    const { hasError, error, errorCount } = this.state
    const { children, fallback, isolate, level = 'component' } = this.props

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>
      }

      if (level === 'page') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="max-w-md w-full bg-card shadow-lg rounded-lg p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-danger-subtle rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-danger" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
                <p className="text-muted-foreground mb-6">
                  We encountered an unexpected error. Please try refreshing the page or going back to the dashboard.
                </p>
                {import.meta.env.DEV && (
                  <details className="w-full mb-6 text-left">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Error details</summary>
                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto">
                      {error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => (window.location.href = '/')}>
                    <Home className="w-4 h-4" />
                    Go to Dashboard
                  </Button>
                  <Button onClick={() => window.location.reload()}>
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      if (level === 'section') {
        return (
          <div className="bg-card rounded-lg shadow-sm border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-warning-subtle rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Unable to load this section</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  There was a problem loading this part of the page. You can try refreshing or continue using other sections.
                </p>
                {errorCount >= 3 && (
                  <p className="text-sm text-warning mb-3">
                    This error has occurred multiple times. Please contact support if it persists.
                  </p>
                )}
                <Button variant="link" onClick={this.resetErrorBoundary} className="text-sm text-primary hover:text-primary/80 px-0">
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )
      }

      if (isolate) {
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-danger-subtle text-danger-fg rounded-md text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Failed to load</span>
            <Button
              variant="link"
              onClick={this.resetErrorBoundary}
              className="text-sm text-danger-fg px-0 h-auto underline hover:no-underline"
            >
              Retry
            </Button>
          </div>
        )
      }

      return (
        <div className="p-4 bg-danger-subtle border border-danger/30 rounded-lg">
          <div className="flex items-center gap-2 text-danger-fg">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Component Error</span>
          </div>
          <p className="text-sm text-danger mt-1">This component failed to render properly.</p>
          <Button
            variant="link"
            onClick={this.resetErrorBoundary}
            className="mt-2 text-sm text-danger-fg hover:text-danger-fg/80 px-0 h-auto underline"
          >
            Try again
          </Button>
        </div>
      )
    }

    return children
  }
}
