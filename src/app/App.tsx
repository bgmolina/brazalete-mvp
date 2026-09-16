import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { PageLoader } from './components/PageLoader'
import { authRoutes } from '@auth/routes/authRoutes'
import { monitoringRoutes } from '@monitoring/routes/monitoringRoutes'
import { settingsRoutes } from '@settings/routes/settingsRoutes'
const AppLayout = lazy(() =>
  import('./components/AppLayout').then((m) => ({ default: m.AppLayout })),
)
export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {authRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            <Route element={<AppLayout />}>
              {[...monitoringRoutes, ...settingsRoutes].map(({ path, Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/demo" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}
