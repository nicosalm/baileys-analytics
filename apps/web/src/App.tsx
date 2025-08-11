import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { swrConfig } from '@/hooks/swr-config'
import { AuthProvider } from '@/contexts/auth'
import { ToastProvider } from '@/contexts/toast'
import { DashboardProvider } from '@/contexts/dashboard'
import { DrillDownProvider } from '@/contexts/drillDown'
import { TaxConfigProvider } from '@/contexts/taxConfig'
import { ModalProvider } from '@/contexts/modal'
import { ModalManager } from '@/components/ModalManager'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoadingState } from '@/components/LoadingState'

// Lazy load pages
const Landing = lazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then(m => ({ default: m.Signup })))
const DashboardLayout = lazy(() => import('@/pages/DashboardLayout').then(m => ({ default: m.DashboardLayout })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))

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
              <Route path="/signup" element={<Signup />} />

              <Route element={<ProtectedRoute />}>
                <Route
                  path="/dashboard/*"
                  element={
                    <DashboardProvider>
                      <DrillDownProvider>
                        <TaxConfigProvider>
                          <ModalProvider>
                            <DashboardLayout />
                            <ModalManager />
                          </ModalProvider>
                        </TaxConfigProvider>
                      </DrillDownProvider>
                    </DashboardProvider>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <TaxConfigProvider>
                      <Settings />
                    </TaxConfigProvider>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  )
}
