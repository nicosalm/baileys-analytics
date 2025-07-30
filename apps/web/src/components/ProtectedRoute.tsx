import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export const ProtectedRoute = () => {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return <div className="p-4">Loading...</div>
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
