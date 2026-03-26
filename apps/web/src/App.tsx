import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { swrConfig } from '@/hooks/swr-config'
import { AuthProvider } from '@/contexts/auth'
import { ThemeProvider } from '@/contexts/theme'
import { Toaster } from '@/components/ui/sonner'
import { DashboardProvider } from '@/contexts/dashboard'
import { ModalProvider } from '@/contexts/modal'
import { ModalManager } from '@/components/ModalManager'
import { ProtectedRoute, NoDemoRoute } from '@/components/ProtectedRoute'
import { SubscriptionGate } from '@/components/SubscriptionGate'
import { LoadingState } from '@/components/LoadingState'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Lazy load pages
const Landing = lazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then(m => ({ default: m.Signup })))
const DashboardLayout = lazy(() => import('@/pages/DashboardLayout').then(m => ({ default: m.DashboardLayout })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Terms = lazy(() => import('@/pages/Terms').then(m => ({ default: m.Terms })))
const Privacy = lazy(() => import('@/pages/Privacy').then(m => ({ default: m.Privacy })))
const Help = lazy(() => import('@/pages/Help').then(m => ({ default: m.Help })))
const OwnerRezDataGuide = lazy(() => import('@/pages/OwnerRezDataGuide').then(m => ({ default: m.OwnerRezDataGuide })))
const ApiDocs = lazy(() => import('@/pages/ApiDocs').then(m => ({ default: m.ApiDocs })))
const Admin = lazy(() => import('@/pages/Admin').then(m => ({ default: m.Admin })))
const NotFound = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })))
const AuthCallback = lazy(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const Branding = lazy(() => import('@/pages/Branding').then(m => ({ default: m.Branding })))

const ResetPassword = lazy(() => import('@/pages/ResetPassword').then(m => ({ default: m.ResetPassword })))

const ScrollToTop = () => {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

export const App = () => {
  return (
    <ErrorBoundary level="page">
      <ThemeProvider>
        <SWRConfig value={swrConfig}>
          <BrowserRouter>
            <AuthProvider>
            <ScrollToTop />
            <Toaster position="bottom-right" richColors />
            <Suspense fallback={<LoadingState fullScreen />}>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/help" element={<Help />} />
              <Route path="/docs/ownerrez-data" element={<OwnerRezDataGuide />} />
              <Route path="/docs/api" element={<ApiDocs />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/branding" element={<Branding />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
                <Route
                  path="/dashboard/:tab"
                  element={
                    <SubscriptionGate>
                      <DashboardProvider>
                        <ModalProvider>
                          <DashboardLayout />
                          <ModalManager />
                        </ModalProvider>
                      </DashboardProvider>
                    </SubscriptionGate>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <NoDemoRoute>
                      <ModalProvider>
                        <Settings />
                        <ModalManager />
                      </ModalProvider>
                    </NoDemoRoute>
                  }
                />
                <Route path="/admin" element={<NoDemoRoute><Admin /></NoDemoRoute>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </SWRConfig>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
