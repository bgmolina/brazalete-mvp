import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@auth/pages/LoginPage'
import { useAuthStore } from '@auth/store/authStore'
import { useSettingsStore } from '@shared/store/settingsStore'
import {
  MonitoringActionsContext,
  type MonitoringActions,
} from '@shared/hooks/useMonitoringActions'
import { realEngine, demoEngine, useMonitoringStore } from '@shared/store/monitoringStore'
import { DashboardPage } from '@monitoring/pages/DashboardPage'
import { AlertsPage } from '@monitoring/pages/AlertsPage'
import { SettingsPage } from '@settings/pages/SettingsPage'
import App from '@/app/App'
import type { ReactNode } from 'react'
vi.mock('@monitoring/components/TelemetryCharts', () => ({
  LiveChart: () => <div>Gráfico en vivo</div>,
  HistoryChart: () => <div>Gráfico histórico</div>,
  MotionChart: () => <div>Gráfico de movimiento</div>,
}))
const actions: MonitoringActions = {
  mode: 'real',
  supported: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  measureHeartRate: vi.fn(),
  scenario: 'rest',
  simulate: vi.fn(),
  togglePause: vi.fn(),
  resetDemo: vi.fn(),
}
function wrap(children: ReactNode, mode: 'real' | 'demo' = 'real') {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <MonitoringActionsContext.Provider value={{ ...actions, mode }}>
          {children}
        </MonitoringActionsContext.Provider>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore.setState({ authenticated: false })
  useSettingsStore.setState({ name: '', age: null, profile: null, warning: null })
  realEngine.clearHistory()
  demoEngine.clearHistory()
  realEngine.connection('disconnected')
  window.history.replaceState({}, '', '/#/login')
})
describe('Acceso y rutas', () => {
  it('valida campos y muestra errores accesibles', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Ingresar a mi espacio/ }))
    expect(await screen.findByText('Ingresá tu usuario')).toBeVisible()
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'true')
  })
  it('rechaza contraseña incorrecta y permite ver/ocultar su contenido', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('Usuario'), 'admin')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: /Ingresar a mi espacio/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no son correctos')
    expect(useAuthStore.getState().authenticated).toBe(false)
  })
  it('usa las credenciales demo predeterminadas cuando el entorno está vacío', async () => {
    vi.stubEnv('VITE_ADMIN_USERNAME', '')
    vi.stubEnv('VITE_ADMIN_PASSWORD', '')
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('Usuario'), 'admin')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }))
    expect(useAuthStore.getState().authenticated).toBe(true)
  })
  it('una configuración vacía conserva una sesión abierta usando los valores demo', async () => {
    vi.stubEnv('VITE_ADMIN_USERNAME', '')
    vi.stubEnv('VITE_ADMIN_PASSWORD', '')
    useAuthStore.setState({ authenticated: true })
    window.history.replaceState({}, '', '/#/demo')
    render(<App />)
    expect(await screen.findByText('Elena Martínez')).toBeVisible()
    expect(window.location.hash).toBe('#/demo')
  })
  it('protege rutas y permite login, cambio de modo y logout', async () => {
    window.history.replaceState({}, '', '/#/monitoreo')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Estamos para/ })).toBeVisible()
    expect(window.location.hash).toBe('#/login')
    await userEvent.type(screen.getByLabelText('Usuario'), 'admin')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: /Ingresar a mi espacio/ }))
    expect(await screen.findByText('Elena Martínez')).toBeVisible()
    expect(sessionStorage.getItem('brazalete:session')).toBe('active')
    expect(JSON.stringify(sessionStorage)).not.toContain('password')
    await userEvent.click(screen.getByRole('button', { name: 'En vivo' }))
    expect(await screen.findByText('Tu persona de cuidado')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(await screen.findByLabelText('Usuario')).toBeVisible()
    expect(sessionStorage.getItem('brazalete:session')).toBeNull()
  })
})
describe('Panel, configuración y eventos', () => {
  it('ofrece una acción guiada para volver a medir el pulso del H7', async () => {
    realEngine.attach('h7-test', 'H7')
    realEngine.protocol('veepoo', 'receiving')
    realEngine.ingest({
      deviceId: 'h7-test',
      source: 'real',
      timestamp: Date.now(),
      kind: 'heartRate',
      value: 82,
      contact: true,
    })
    realEngine.publish()
    wrap(<DashboardPage />)
    expect(screen.getByText('1 · Brazalete firme')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar BPM' }))
    expect(actions.measureHeartRate).toHaveBeenCalledOnce()
  })
  it('no rellena sensores parciales con datos ficticios', async () => {
    realEngine.attach('test', 'Sensor parcial')
    realEngine.capability('heartRate', 'available')
    realEngine.capability('acceleration', 'unsupported')
    wrap(<DashboardPage />)
    expect(await screen.findByText('Acelerómetro no disponible')).toBeVisible()
    expect(screen.getAllByText('No compatible')).toHaveLength(3)
    expect(screen.getByText('Esperando una lectura')).toBeVisible()
    expect(screen.queryByText('Elena Martínez')).not.toBeInTheDocument()
  })
  it('guarda ficha real y valida edad, sin cambiar el perfil de demo', async () => {
    wrap(<SettingsPage />)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    fireEvent.change(screen.getByLabelText(/Edad/), { target: { value: '130' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Ingresá una edad entre 1 y 120 años.')).toBeVisible()
    fireEvent.change(screen.getByLabelText(/Edad/), { target: { value: '78' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    await waitFor(() => expect(useSettingsStore.getState().name).toBe('Ana Pérez'))
    expect(useSettingsStore.getState().age).toBe(78)
  })
  it('valida JSON de perfil antes de guardar', async () => {
    wrap(<SettingsPage />)
    fireEvent.change(screen.getByLabelText('Definición del perfil (JSON)'), {
      target: { value: '{mal}' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Validar y aplicar perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON válido')
    expect(useSettingsStore.getState().profile).toBeNull()
  })
  it('permite revisar evento y filtrar pendientes', async () => {
    realEngine.attach('test', 'Reloj')
    realEngine.ingest({
      deviceId: 'test',
      source: 'real',
      timestamp: Date.now(),
      kind: 'heartRate',
      value: 0,
      contact: false,
    })
    realEngine.publish()
    wrap(<AlertsPage />)
    await userEvent.click(screen.getByRole('button', { name: /Lectura de 0 BPM/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Contacto: no detectado')
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como revisada' }))
    expect(screen.getByRole('button', { name: 'Ya revisada' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Sin revisar' }))
    expect(screen.getByText('Todo en orden por acá')).toBeVisible()
  })
  it('limpieza solicita confirmación y no toca otras claves', async () => {
    localStorage.setItem('otro-sitio', 'preservado')
    realEngine.attach('test', 'Reloj')
    realEngine.ingest({
      deviceId: 'test',
      source: 'real',
      timestamp: Date.now(),
      kind: 'heartRate',
      value: 0,
      contact: null,
    })
    wrap(<SettingsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar historial real' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Conservar historial' }))
    expect(useMonitoringStore.getState().real.events).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar historial real' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, limpiar historial' }))
    expect(useMonitoringStore.getState().real.events).toHaveLength(0)
    expect(localStorage.getItem('otro-sitio')).toBe('preservado')
  })
  it('los eventos del modo demo no aparecen en alertas reales', () => {
    act(() => {
      demoEngine.attach('demo', 'Demo')
      demoEngine.addDemoEvent('possible-fall', 'Simulado', Date.now())
    })
    wrap(<AlertsPage />)
    expect(screen.getByText('Todo en orden por acá')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Posible caída/ })).not.toBeInTheDocument()
  })
})
