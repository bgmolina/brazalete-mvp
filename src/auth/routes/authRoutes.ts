import { lazy } from 'react'
export const authRoutes = [
  {
    path: '/login',
    Component: lazy(() => import('@auth/pages/LoginPage').then((m) => ({ default: m.LoginPage }))),
  },
]
