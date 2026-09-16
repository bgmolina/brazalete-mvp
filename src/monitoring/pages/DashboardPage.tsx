import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bluetooth,
  BluetoothConnected,
  ChevronRight,
  CircleAlert,
  Clock3,
  Footprints,
  HeartPulse,
  Info,
  Leaf,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDashboard } from '@monitoring/hooks/useDashboard'
import { Capabilities } from '@monitoring/components/Capabilities'
import { EventRow } from '@monitoring/components/EventRow'
import { CareIllustration, PersonAvatar } from '@shared/components/CareIllustration'
import { number, relativeTime, time } from '@shared/utils/format'
import type { Scenario } from '@shared/hooks/useMonitoringActions'

const LiveChart = lazy(() =>
  import('@monitoring/components/TelemetryCharts').then((m) => ({ default: m.LiveChart })),
)
const HistoryChart = lazy(() =>
  import('@monitoring/components/TelemetryCharts').then((m) => ({ default: m.HistoryChart })),
)
const MotionChart = lazy(() =>
  import('@monitoring/components/TelemetryCharts').then((m) => ({ default: m.MotionChart })),
)
const scenarios: { value: Scenario; label: string }[] = [
  { value: 'rest', label: 'Reposo' },
  { value: 'moving', label: 'Movimiento' },
  { value: 'zero', label: 'Lectura cero' },
  { value: 'fall', label: 'Posible caída' },
  { value: 'disconnected', label: 'Desconexión' },
]
const connectionLabels = {
  disconnected: 'Sin conexión',
  requesting: 'Elegí una pulsera',
  connecting: 'Conectando…',
  connected: 'Dispositivo conectado',
  reconnecting: 'Reconectando…',
  error: 'Error de conexión',
}
function ChartLoading() {
  return <Skeleton className="h-56 w-full rounded-lg" />
}
export function DashboardPage() {
  const vm = useDashboard()
  const { snapshot: s, actions: a } = vm
  const demo = a.mode === 'demo'
  const navigate = useNavigate()
  const base = demo ? '/demo' : '/monitoreo'
  const connected = s.connection === 'connected'
  const loading = ['requesting', 'connecting', 'reconnecting'].includes(s.connection)
  const motionAvailable = s.capabilities.acceleration === 'available'
  const noContact = s.contact === false
  const heartLabel = vm.stale
    ? 'Lectura desactualizada'
    : noContact
      ? 'Sin contacto con la piel'
      : s.heartRate === 0
        ? 'Revisar medición'
        : s.heartRate === null
          ? 'Esperando una lectura'
          : 'Última lectura recibida'
  return (
    <div className="dashboard-page page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UN VISTAZO A SU DÍA</span>
          <h1>
            Estar cerca, incluso a la distancia<span className="heading-dot">.</span>
          </h1>
          <p>Un espacio para observar, comprender y acompañar.</p>
        </div>
        <span className={`mode-tag ${demo ? 'demo-tag' : ''}`}>
          {demo ? <Sparkles size={14} /> : <Radio size={14} />}{' '}
          {demo ? 'Modo demostración' : 'Monitoreo real'}
        </span>
      </div>
      {demo ? (
        <div className="demo-banner">
          <div>
            <Sparkles size={17} />
            <span>
              <strong>Estás explorando una demo.</strong> Todos los datos y eventos son ficticios.
            </span>
          </div>
          <Link to="/monitoreo">
            Conectar mi pulsera <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="real-banner">
          <ShieldCheck size={16} />
          <span>
            Datos locales y privados. La recolección requiere esta página abierta y la computadora
            activa.
          </span>
        </div>
      )}
      <section className="person-card" aria-label="Persona y dispositivo">
        <div className="person-info">
          <PersonAvatar />
          <div>
            <h2>{vm.person.name}</h2>
            <p>
              {vm.person.age ? `${vm.person.age} años · ` : ''}
              {s.deviceName || 'Sin pulsera vinculada'}
              {demo ? ' · Perfil de ejemplo' : ''}
            </p>
          </div>
        </div>
        <div className="person-actions">
          <span className={`connection-label ${connected && !s.paused ? 'connected' : ''}`}>
            <span className="status-dot" />
            {s.paused ? 'Simulación pausada' : connectionLabels[s.connection]}
          </span>
          {!demo ? (
            <Button
              variant={connected ? 'outline' : 'default'}
              disabled={loading || !a.supported}
              onClick={() => (connected ? a.disconnect() : void a.connect())}
            >
              {connected ? <Unplug /> : <Bluetooth />}
              {connected ? 'Desconectar' : loading ? 'Conectando…' : 'Conectar pulsera'}
            </Button>
          ) : (
            <span className="battery-label">
              <BluetoothConnected size={16} /> {s.battery ?? '—'}% batería
            </span>
          )}
        </div>
      </section>
      {s.error ? (
        <div className="notice notice-warning" role="alert">
          <CircleAlert size={18} />
          {s.error}
        </div>
      ) : null}
      {s.storageWarning ? (
        <div className="notice notice-warning" role="status">
          {s.storageWarning}
        </div>
      ) : null}
      {!demo && !connected ? (
        <section className="connection-onboarding">
          <div>
            <span className="eyebrow">EL PRIMER PASO PARA ESTAR CERCA</span>
            <h2>Tu pulsera, conectada a su bienestar.</h2>
            <p>
              {a.supported
                ? 'Encendé la pulsera, acercala a la computadora y elegila en la ventana de Bluetooth. Te mostraremos qué sensores están disponibles.'
                : 'Necesitás Chrome o Edge de escritorio en un sitio HTTPS o localhost, con Web Bluetooth y el Bluetooth del equipo habilitados.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!a.supported || loading} onClick={() => void a.connect()}>
                <Bluetooth /> Buscar dispositivo
              </Button>
              <Button variant="link" asChild>
                <Link to="/configuracion">
                  Ver compatibilidad <ArrowRight />
                </Link>
              </Button>
            </div>
            <span className="onboarding-footnote">
              El sensor debe exponer servicios BLE compatibles. No todas las pulseras lo hacen.
            </span>
          </div>
          <CareIllustration variant="device" />
        </section>
      ) : null}
      <section className="metric-grid" aria-label="Métricas del monitoreo">
        <article
          className={`metric-card pulse-metric ${s.heartRate === 0 && !vm.stale ? 'metric-alert' : ''}`}
        >
          <div className="metric-label">
            Frecuencia cardíaca{' '}
            <span className="metric-icon">
              <HeartPulse size={18} />
            </span>
          </div>
          <div className={`metric-value ${vm.stale ? 'stale-value' : ''}`}>
            {s.heartRate ?? '—'}
            <span>BPM</span>
            {s.heartRate !== null && !vm.stale ? (
              <span className="mini-pulse">
                <Activity size={47} strokeWidth={1.4} />
              </span>
            ) : null}
          </div>
          <p className={vm.stale || noContact || s.heartRate === 0 ? 'warning-text' : ''}>
            <span className="status-dot" />
            {heartLabel}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            Rango del período{' '}
            <span className="metric-icon">
              <Activity size={18} />
            </span>
          </div>
          <div className="range-values">
            <span>
              <ArrowDown size={16} />
              <strong>{vm.min ?? '—'}</strong>
            </span>
            <span className="range-divider" />
            <span>
              <ArrowUp size={16} />
              <strong>{vm.max ?? '—'}</strong>
            </span>
            <small>BPM</small>
          </div>
          <p>
            Sólo lecturas válidas ·{' '}
            {vm.period >= 24
              ? `${vm.period / 24} día${vm.period > 24 ? 's' : ''}`
              : `${vm.period} h`}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            Movimiento{' '}
            <span className="metric-icon">
              <Footprints size={18} />
            </span>
          </div>
          <div className="metric-value movement-value">
            {s.motion === 'rest'
              ? 'En reposo'
              : s.motion === 'moving'
                ? 'En movimiento'
                : 'Sin datos'}
          </div>
          <p>
            {s.capabilities.steps === 'available' ? (
              <>
                <strong>{number(s.steps)}</strong> pasos en esta sesión
              </>
            ) : (
              'Pasos: sensor sin datos disponibles'
            )}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            Última actualización{' '}
            <span className="metric-icon">
              <Clock3 size={18} />
            </span>
          </div>
          <div className="metric-value time-value">
            {s.lastHeartAt ? time(s.lastHeartAt, true) : '—'}
          </div>
          <p>
            {s.lastHeartAt ? relativeTime(s.lastHeartAt, s.now) : 'Aún no recibimos lecturas'}
            {demo ? ' · Simulada' : ''}
          </p>
        </article>
      </section>
      <div className="live-grid">
        <section className="panel live-panel">
          <div className="panel-heading">
            <div>
              <h2>Un pulso de su presente</h2>
              <p>Frecuencia cardíaca · Últimos 10 minutos</p>
            </div>
            <span className={`live-pill ${connected && !s.paused && !vm.stale ? 'active' : ''}`}>
              <span className="status-dot" />
              {s.paused ? 'Pausado' : connected && !vm.stale ? 'En vivo' : 'Sin señal actual'}
            </span>
          </div>
          <div className="chart-unit">BPM</div>
          {s.heartPoints.length ? (
            <Suspense fallback={<ChartLoading />}>
              <LiveChart points={s.heartPoints} />
            </Suspense>
          ) : (
            <div className="empty-chart">
              <HeartPulse size={29} />
              <strong>Las primeras lecturas aparecerán acá</strong>
              <span>
                {connected
                  ? 'Esperando datos del sensor cardíaco.'
                  : 'Conectá un dispositivo para comenzar.'}
              </span>
            </div>
          )}
          <div className="chart-footer">
            <span>
              <i className="legend-dot" /> {demo ? 'Frecuencia simulada' : 'Frecuencia recibida'}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="muted-icon"
                  aria-label="Información sobre calidad de las lecturas"
                >
                  <Info size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Los huecos indican falta de datos. Coral: 0 BPM. Ámbar: contacto rechazado. No es
                una señal ECG.
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
        <aside className="care-panel">
          <div className="care-panel-leaf">
            <Leaf size={24} />
          </div>
          <span className="eyebrow">CUIDAR ES ACOMPAÑAR</span>
          <h2>
            Cada dato cuenta.
            <br />
            Tu presencia, más.
          </h2>
          <p>
            Una lectura es una señal para prestar atención, no un diagnóstico. Ante una emergencia,
            buscá asistencia médica.
          </p>
          <div className="care-panel-divider" />
          <div className="care-status">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {s.fallPending
                  ? 'Evaluando un posible impacto'
                  : s.fallReady
                    ? 'Detección experimental activa'
                    : 'Detección de caídas no disponible'}
              </strong>
              <span>
                {s.fallReady
                  ? 'Impacto seguido de inmovilidad.'
                  : 'Requiere aceleración calibrada y continua ≥ 20 Hz.'}
              </span>
            </div>
          </div>
        </aside>
      </div>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Su ritmo, a lo largo del tiempo</h2>
            <p>
              Promedio y rango de frecuencia cardíaca ·{' '}
              {demo ? 'Historial simulado' : 'Agregados guardados en este navegador'}
            </p>
          </div>
          <div className="period-selector" aria-label="Período del historial">
            {vm.periods.map((p) => (
              <button
                key={p.hours}
                aria-pressed={vm.period === p.hours}
                className={vm.period === p.hours ? 'active' : ''}
                onClick={() => vm.setPeriod(p.hours)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-unit">BPM</div>
        <Suspense fallback={<ChartLoading />}>
          <HistoryChart key={vm.viewKey} points={vm.history} hours={vm.period} />
        </Suspense>
        <div className="chart-footer">
          <div className="chart-legends">
            <span>
              <i className="legend-dot" /> Promedio
            </span>
            <span>
              <i className="legend-range" /> Mínimo / máximo
            </span>
            <span className="brush-help">Arrastrá los extremos para explorar</span>
          </div>
          <Button size="sm" variant="ghost" onClick={vm.resetView}>
            <RotateCcw size={13} /> Restablecer
          </Button>
        </div>
      </section>
      <div className="movement-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pequeños movimientos</h2>
              <p>Aceleración del dispositivo · Magnitud en g</p>
            </div>
            <Activity size={19} className="text-muted-foreground" />
          </div>
          {motionAvailable && s.acceleration.length ? (
            <>
              <Suspense fallback={<ChartLoading />}>
                <MotionChart points={s.acceleration} />
              </Suspense>
              <div className="sensor-table-wrap">
                <table className="sensor-table">
                  <caption className="sr-only">
                    Últimas muestras del acelerómetro en unidades g
                  </caption>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>X</th>
                      <th>Y</th>
                      <th>Z</th>
                      <th>Magnitud</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.acceleration
                      .filter((_, i) => i % 20 === 0)
                      .slice(-3)
                      .reverse()
                      .map((p) => (
                        <tr key={p.timestamp}>
                          <td>{time(p.timestamp, true)}</td>
                          <td>{p.x.toFixed(2)}</td>
                          <td>{p.y.toFixed(2)}</td>
                          <td>{p.z.toFixed(2)}</td>
                          <td>{p.magnitude.toFixed(2)} g</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="table-footnote">
                Interpretación actual:{' '}
                {s.motion === 'rest'
                  ? 'baja variación / reposo'
                  : s.motion === 'moving'
                    ? 'movimiento detectado'
                    : 'sin datos suficientes'}
                .
              </p>
            </>
          ) : (
            <div className="empty-chart">
              <Activity size={28} />
              <strong>Acelerómetro no disponible</strong>
              <span>Necesitás un perfil compatible para recibir movimiento.</span>
              <Link to="/configuracion">
                Configurar perfil BLE <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel events-preview">
          <div className="panel-heading">
            <div>
              <h2>Lo que merece atención</h2>
              <p>Eventos recientes {demo ? '· Simulados' : '· Locales'}</p>
            </div>
            <Badge variant="secondary">
              {s.events.filter((e) => !e.reviewed).length} pendientes
            </Badge>
          </div>
          {s.events.length ? (
            s.events
              .slice(0, 3)
              .map((e) => (
                <EventRow key={e.id} event={e} onClick={() => navigate(`${base}/alertas`)} />
              ))
          ) : (
            <div className="empty-chart">
              <ShieldCheck size={29} />
              <strong>Sin eventos registrados</strong>
              <span>Las lecturas cero y posibles caídas se mostrarán acá.</span>
            </div>
          )}
          <Link className="all-events-link" to={`${base}/alertas`}>
            Ver todos los eventos <ArrowRight size={15} />
          </Link>
          <div className="local-event-note">
            <Info size={14} />
            {demo
              ? 'Ejemplos para conocer la experiencia.'
              : 'Registro local; envío no implementado.'}
          </div>
        </section>
      </div>
      {demo ? (
        <section className="simulation-panel">
          <div>
            <span className="simulation-icon">
              <Settings2 size={20} />
            </span>
            <div>
              <h3>Explorá diferentes escenarios</h3>
              <p>Probá cómo responde el panel. No se envía ninguna notificación.</p>
            </div>
          </div>
          <div className="simulation-controls">
            {scenarios.map((sc) => (
              <button
                key={sc.value}
                aria-pressed={a.scenario === sc.value}
                className={a.scenario === sc.value ? 'selected' : ''}
                onClick={() => a.simulate(sc.value)}
              >
                {sc.label}
              </button>
            ))}
            <Button
              variant="outline"
              size="icon"
              aria-label={s.paused ? 'Reanudar simulación' : 'Pausar simulación'}
              onClick={a.togglePause}
            >
              {s.paused ? <Play /> : <Pause />}
            </Button>
            <Button variant="outline" size="icon" aria-label="Reiniciar demo" onClick={a.resetDemo}>
              <RotateCcw />
            </Button>
          </div>
          {a.scenario === 'fall' ? (
            <p className="simulation-hint" role="status">
              El escenario necesita aproximadamente 13 segundos de señal continua para registrar el
              evento.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="panel sensors-panel">
          <div className="panel-heading">
            <div>
              <h2>Sensores de la pulsera</h2>
              <p>Cada capacidad se verifica de forma independiente.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/configuracion">
                <Settings2 /> Configurar
              </Link>
            </Button>
          </div>
          <Capabilities value={s.capabilities} />
          <p className="table-footnote">
            Identificador del navegador: {s.deviceId || 'sin dispositivo seleccionado'}
            {s.battery !== null ? ` · Batería: ${s.battery}%` : ''}
          </p>
        </section>
      )}
    </div>
  )
}
