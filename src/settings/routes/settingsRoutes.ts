import { lazy } from 'react'
export const settingsRoutes = [
  {
    path: '/configuracion',
    Component: lazy(() =>
      import('@settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
    ),
  },
]
