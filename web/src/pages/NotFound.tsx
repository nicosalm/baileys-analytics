import '@/styles/newsreader.css'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { LogoCube } from '@/components/LogoCube'
import { usePageTitle } from '@/hooks/use-page-title'

export const NotFound = () => {
  usePageTitle('Page not found')
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <Link to="/" aria-label="Home" className="inline-block mb-8">
          <LogoCube className="w-8 h-8" />
        </Link>
        <p className="text-sm font-medium text-muted-foreground tabular-nums">404</p>
        <h1 className="landing-serif mt-1 text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">The link may be out of date, or the page has moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to={isAuthenticated ? '/dashboard/overview' : '/'}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {isAuthenticated ? 'Go to dashboard' : 'Go to home page'}
          </Link>
          <Link
            to="/help"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Help
          </Link>
        </div>
      </div>
    </main>
  )
}
