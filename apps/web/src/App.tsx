import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { swrConfig } from '@/hooks/swr-config'
import { AuthProvider } from '@/contexts/auth'
import { ToastProvider } from '@/contexts/toast'
import { DashboardProvider } from '@/contexts/dashboard'
import { ModalProvider } from '@/contexts/modal'
import { ModalManager } from '@/components/ModalManager'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoadingState } from '@/components/LoadingState'

// Lazy load pages
const Landing = lazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then(m => ({ default: m.Signup })))
const Waitlist = lazy(() => import('@/pages/Waitlist').then(m => ({ default: m.Waitlist })))
const DashboardLayout = lazy(() => import('@/pages/DashboardLayout').then(m => ({ default: m.DashboardLayout })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Terms = lazy(() => import('@/pages/Terms').then(m => ({ default: m.Terms })))
const Privacy = lazy(() => import('@/pages/Privacy').then(m => ({ default: m.Privacy })))
const NotFound = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })))

export const App = () => {
  return (
    <SWRConfig value={swrConfig}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
          <Suspense fallback={<LoadingState fullScreen />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Waitlist />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
                <Route
                  path="/dashboard/:tab"
                  element={
                    <DashboardProvider>
                      <ModalProvider>
                        <DashboardLayout />
                        <ModalManager />
                      </ModalProvider>
                    </DashboardProvider>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ModalProvider>
                    <Settings />
                    <ModalManager />
                  </ModalProvider>
                  }
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  )
}
