import { Suspense, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Brand } from '@shared/components/Brand'
import { Button } from '@/components/ui/button'
import { PageLoader } from './PageLoader'
import { useAuthStore } from '@auth/store/authStore'
import { MonitoringRuntime } from './MonitoringRuntime'
import type { Mode } from '@shared/types/monitoring'
import { useMonitoringStore } from '@shared/store/monitoringStore'
import { useMobileNavigation } from '@app/hooks/useMobileNavigation'
import { SourceSwitcher } from './SourceSwitcher'

export function AppLayout() {
  const authenticated = useAuthStore((s) => s.authenticated)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const routeMode: Mode | null = location.pathname.startsWith('/demo')
    ? 'demo'
    : location.pathname.startsWith('/monitoreo')
      ? 'real'
      : null
  const [lastMode, setLastMode] = useState<Mode>('demo')
  const { menu, setMenu, sidebarRef, triggerRef } = useMobileNavigation()
  const mode = routeMode ?? lastMode
  const pending = useMonitoringStore((s) => s[mode].events.filter((e) => !e.reviewed).length)
  useEffect(() => {
    if (routeMode) setLastMode(routeMode)
  }, [routeMode])
  const configured = Boolean(
    import.meta.env.VITE_ADMIN_USERNAME && import.meta.env.VITE_ADMIN_PASSWORD,
  )
  if (!authenticated || !configured) return <Navigate to="/login" replace />
  const base = mode === 'demo' ? '/demo' : '/monitoreo'
  const page = location.pathname.endsWith('/alertas')
    ? 'Alertas y eventos'
    : location.pathname === '/configuracion'
      ? 'Configuración'
      : 'Vista general'
  return (
    <MonitoringRuntime mode={mode}>
      <a href="#main-content" className="skip-link">
        Ir al contenido
      </a>
      <div className="app-shell">
        {menu ? (
          <button
            className="sidebar-backdrop"
            tabIndex={-1}
            aria-label="Cerrar navegación"
            onClick={() => setMenu(false)}
          />
        ) : null}
        <aside
          ref={sidebarRef}
          role={menu ? 'dialog' : undefined}
          aria-modal={menu || undefined}
          className={`sidebar ${menu ? 'sidebar-open' : ''}`}
          aria-label="Navegación principal"
        >
          <div className="sidebar-brand">
            <Brand />
            <button
              className="mobile-close"
              onClick={() => setMenu(false)}
              aria-label="Cerrar menú"
            >
              <X size={21} />
            </button>
          </div>
          <div className="workspace-chip">
            <span className="workspace-icon">
              <Heart size={15} />
            </span>
            <div>
              <strong>Mi espacio de cuidado</strong>
              <span>Una persona, toda tu atención</span>
            </div>
          </div>
          <span className="nav-section-label">ACOMPAÑAMIENTO</span>
          <nav className="primary-nav">
            <NavLink to={base} end>
              <LayoutDashboard size={19} />
              <span>Vista general</span>
            </NavLink>
            <NavLink to={`${base}/alertas`}>
              <Bell size={19} />
              <span>Alertas y eventos</span>
              {pending ? <span className="nav-count">{pending}</span> : null}
            </NavLink>
            <NavLink to="/configuracion">
              <Settings2 size={19} />
              <span>Configuración</span>
            </NavLink>
          </nav>
          <SourceSwitcher />
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <div className="leaf-motif">
                <Activity size={24} />
              </div>
              <strong>Un poquito más cerca.</strong>
              <p>La información que necesitás para acompañar cada día.</p>
              <span>
                <ShieldCheck size={13} /> Guardado en tu dispositivo
              </span>
            </div>
            <button className="sign-out" onClick={logout}>
              <LogOut size={17} /> Cerrar sesión <ArrowUpRight size={15} />
            </button>
            <p className="sidebar-version">BRAZALETE · MVP 1.0</p>
          </div>
        </aside>
        <div className="main-shell" inert={menu || undefined}>
          <header className="topbar">
            <div className="flex items-center gap-3">
              <Button
                ref={triggerRef}
                variant="ghost"
                size="icon"
                className="mobile-menu"
                aria-label="Abrir menú"
                onClick={() => setMenu(true)}
              >
                <Menu />
              </Button>
              <span className="breadcrumb-home">Mi espacio</span>
              <ChevronRight size={13} className="text-muted-foreground" />
              <span className="breadcrumb-current">{page}</span>
            </div>
            <div className="topbar-right">
              <span className="environment-pill">
                <span className="status-dot" /> Entorno local
              </span>
              <span className="topbar-separator" />
              <div className="admin-avatar">A</div>
              <div className="admin-label">
                <strong>Administrador</strong>
                <span>Cuenta de cuidado</span>
              </div>
            </div>
          </header>
          <main id="main-content" className="main-content" tabIndex={-1}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>
              <Heart size={12} /> Cuidar empieza por estar presente.
            </span>
            <span>Monitoreo orientativo · No es un diagnóstico médico</span>
          </footer>
        </div>
      </div>
    </MonitoringRuntime>
  )
}
