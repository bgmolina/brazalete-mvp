import { lazy } from 'react'
const Dashboard = lazy(() =>
  import('@monitoring/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const Alerts = lazy(() =>
  import('@monitoring/pages/AlertsPage').then((m) => ({ default: m.AlertsPage })),
)
export const monitoringRoutes = [
  { path: '/demo', Component: Dashboard },
  { path: '/monitoreo', Component: Dashboard },
  { path: '/demo/alertas', Component: Alerts },
  { path: '/monitoreo/alertas', Component: Alerts },
]
