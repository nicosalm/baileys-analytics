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
