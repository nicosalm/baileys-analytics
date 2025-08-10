import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { swrConfig } from '@/hooks/swr-config'
import { AuthProvider } from '@/contexts/auth'
import { ToastProvider } from '@/contexts/toast'
import { DashboardProvider } from '@/contexts/dashboard'
import { DrillDownProvider } from '@/contexts/drillDown'
import { TaxConfigProvider } from '@/contexts/taxConfig'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { DashboardLayout } from '@/pages/DashboardLayout'
import { Settings } from '@/pages/Settings'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export const App = () => {
  return (
    <SWRConfig value={swrConfig}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
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
                        <DashboardLayout />
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
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  )
}
