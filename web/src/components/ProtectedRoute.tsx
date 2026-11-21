import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'

export const ProtectedRoute = () => {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// redirects demo users to dashboard — used for settings/admin routes
export const NoDemoRoute = ({ children }: { children: React.ReactNode }) => {
  const { state } = useAuth()

  if (state.status === 'authenticated' && state.user.isDemo) {
    return <Navigate to="/dashboard/overview" replace />
  }

  return <>{children}</>
}
