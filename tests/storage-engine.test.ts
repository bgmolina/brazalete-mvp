import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MonitoringEngine, emptySummary } from '@shared/services/MonitoringEngine'
import { RETENTION_MS, TELEMETRY_KEY, TelemetryStorage } from '@shared/services/telemetryStorage'
import type { DeviceHistory, SensorReading } from '@shared/types/monitoring'
import { historySeries } from '@monitoring/hooks/useDashboard'
const NOW = 1_800_000_000_000
const history = (timestamp: number): DeviceHistory => ({
  deviceId: 'watch',
  deviceName: 'Reloj',
  summaries: [emptySummary(timestamp)],
  events: [
    {
      id: 'event',
      deviceId: 'watch',
      source: 'real',
      timestamp,
      type: 'zero-heart-rate',
      reviewed: false,
      evidence: '0 BPM',
    },
  ],
})
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
describe('Almacenamiento de telemetría', () => {
  it('descarta datos vencidos antes de mostrarlos y preserva los vigentes', () => {
    const old = history(NOW - RETENTION_MS),
      fresh = history(NOW - 60_000)
    fresh.deviceId = 'other'
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify({ version: 1, devices: [old, fresh] }))
    const storage = new TelemetryStorage(localStorage)
    expect(storage.load()).toEqual([fresh])
    expect(JSON.parse(localStorage.getItem(TELEMETRY_KEY)!).devices).toHaveLength(1)
  })
  it('limpia al guardar y al ejecutar mantenimiento', () => {
    const storage = new TelemetryStorage(localStorage)
    storage.save(history(NOW))
    storage.cleanup(NOW + RETENTION_MS + 1)
    expect(storage.load(NOW + RETENTION_MS + 1)).toEqual([])
  })
  it.each(['{broken', '{"version":999,"devices":[]}', '{"version":1,"devices":[{}]}'])(
    'tolera datos corruptos %s',
    (raw) => {
      localStorage.setItem(TELEMETRY_KEY, raw)
      const storage = new TelemetryStorage(localStorage)
      expect(storage.load()).toEqual([])
      expect(storage.warning).toContain('memoria')
      storage.save(history(NOW))
      expect(storage.load()).toHaveLength(1)
    },
  )
  it('con cuota agotada no pierde el dato más reciente al volver a leer', () => {
    const backing = {
      getItem: vi.fn(() => JSON.stringify({ version: 1, devices: [history(NOW - 60_000)] })),
      setItem: vi.fn(() => {
        throw new DOMException('full', 'QuotaExceededError')
      }),
      removeItem: vi.fn(),
    }
    const storage = new TelemetryStorage(backing)
    storage.load()
    storage.save(history(NOW))
    expect(storage.warning).toContain('memoria')
    expect(storage.load()[0].summaries[0].timestamp).toBe(NOW)
  })
  it('soporta ausencia de almacenamiento y borra sólo su clave', () => {
    const unavailable = new TelemetryStorage(null)
    unavailable.save(history(NOW))
    expect(unavailable.load()).toHaveLength(1)
    localStorage.setItem('otro-sitio', 'preservar')
    localStorage.setItem(TELEMETRY_KEY, '{}')
    expect(new TelemetryStorage(localStorage).clear()).toBe(true)
    expect(localStorage.getItem('otro-sitio')).toBe('preservar')
    expect(localStorage.getItem(TELEMETRY_KEY)).toBeNull()
  })
  it('informa si el navegador impide la limpieza', () => {
    const storage = new TelemetryStorage({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(storage.clear()).toBe(false)
    expect(storage.warning).toContain('limpiar')
  })
})
describe('Motor de monitoreo', () => {
  const build = () => {
    const storage = new TelemetryStorage(localStorage)
    const engine = new MonitoringEngine('real', vi.fn(), storage)
    engine.attach('watch', 'Reloj', true)
    return { storage, engine }
  }
  const hr = (
    engine: MonitoringEngine,
    value: number,
    contact: boolean | null = true,
    timestamp = NOW,
  ) =>
    engine.ingest({
      deviceId: 'watch',
      source: 'real',
      kind: 'heartRate',
      value,
      contact,
      timestamp,
    })
  it('cero genera un evento inmediato, ausencia no genera ninguno', () => {
    const { engine } = build()
    engine.tick()
    expect(engine.snapshot().heartRate).toBeNull()
    expect(engine.snapshot().events).toHaveLength(0)
    hr(engine, 0, false)
    expect(engine.snapshot().events[0].evidence).toContain('no detectado')
    const persisted = JSON.parse(localStorage.getItem(TELEMETRY_KEY)!).devices[0]
    expect(persisted.events).toHaveLength(1)
    expect(persisted.summaries[0].zeros).toBe(1)
  })
  it('deduplica episodios cero y permite otro tras recuperación', () => {
    const { engine } = build()
    hr(engine, 0)
    hr(engine, 0)
    hr(engine, 0)
    expect(engine.snapshot().events).toHaveLength(1)
    hr(engine, 70)
    hr(engine, 0)
    expect(engine.snapshot().events).toHaveLength(2)
  })
  it('una interrupción de señal separa episodios cero sin crear un evento por ausencia', () => {
    const { engine } = build()
    hr(engine, 0)
    vi.setSystemTime(NOW + 12_000)
    engine.tick()
    expect(engine.snapshot().events).toHaveLength(1)
    hr(engine, 0, true, NOW + 12_000)
    expect(engine.snapshot().events).toHaveLength(2)
    expect(engine.snapshot().heartPoints.some((p) => p.bpm === null)).toBe(true)
  })
  it('preserva el hueco aunque la pestaña suspendida no haya ejecutado timers', () => {
    const { engine } = build()
    hr(engine, 70)
    vi.setSystemTime(NOW + 30_000)
    hr(engine, 72, true, NOW + 30_000)
    expect(engine.snapshot().heartPoints.map((p) => p.bpm)).toEqual([70, null, 72])
  })
  it('estadísticas excluyen cero y contacto rechazado sin borrarlos', () => {
    const { engine } = build()
    hr(engine, 70)
    hr(engine, 80, null)
    hr(engine, 200, false)
    hr(engine, 0)
    expect(engine.snapshot().summaries[0]).toMatchObject({
      hrSum: 150,
      hrCount: 2,
      hrMin: 70,
      hrMax: 80,
      zeros: 1,
    })
    expect(engine.snapshot().heartPoints).toHaveLength(4)
  })
  it('marca un hueco tras diez segundos conservando valor y hora', () => {
    const { engine } = build()
    hr(engine, 72)
    engine.tick(NOW + 10000)
    expect(engine.snapshot()).toMatchObject({ heartRate: 72, lastHeartAt: NOW })
    expect(engine.snapshot().heartPoints.at(-1)?.bpm).toBeNull()
    expect(engine.snapshot().events).toHaveLength(0)
  })
  it('aísla origen y dispositivo; descarta paquetes inválidos', () => {
    const { engine } = build()
    const base: SensorReading = {
      deviceId: 'watch',
      source: 'real',
      kind: 'heartRate',
      value: 70,
      contact: true,
      timestamp: NOW,
    }
    engine.ingest({ ...base, source: 'demo' })
    engine.ingest({ ...base, deviceId: 'otro' })
    engine.ingest({ ...base, value: -1 })
    engine.ingest({ ...base, timestamp: NaN })
    expect(engine.snapshot().heartRate).toBeNull()
  })
  it('escribe a los cinco segundos, restaura agregados pero no muestras', () => {
    const { engine } = build()
    engine.tick(NOW)
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    spy.mockClear()
    hr(engine, 75)
    engine.tick(NOW + 1000)
    expect(spy).not.toHaveBeenCalled()
    engine.tick(NOW + 5000)
    expect(spy).toHaveBeenCalledTimes(1)
    const restored = new MonitoringEngine(
      'real',
      vi.fn(),
      new TelemetryStorage(localStorage),
    ).snapshot()
    expect(restored.summaries[0].hrCount).toBe(1)
    expect(restored.heartRate).toBeNull()
    expect(restored.heartPoints).toEqual([])
  })
  it('pasos de sesión reinician su base al reconectar', () => {
    const { engine } = build()
    const step = (value: number) =>
      engine.ingest({ deviceId: 'watch', source: 'real', timestamp: NOW, kind: 'steps', value })
    step(100)
    step(110)
    engine.connection('disconnected')
    engine.attach('watch', 'Reloj')
    step(500)
    step(502)
    expect(engine.snapshot().steps).toBe(12)
  })
  it('desconexión registra sólo un evento y no convierte pulso en cero', () => {
    const { engine } = build()
    hr(engine, 74)
    engine.connection('disconnected', null, true)
    engine.connection('disconnected', null, true)
    expect(engine.snapshot().events).toHaveLength(1)
    expect(engine.snapshot().events[0].type).toBe('disconnected')
    expect(engine.snapshot().heartRate).toBe(74)
  })
  it('revisión se persiste y limpieza deja la demo intacta', () => {
    const { engine } = build()
    hr(engine, 0)
    engine.review(engine.snapshot().events[0].id)
    expect(JSON.parse(localStorage.getItem(TELEMETRY_KEY)!).devices[0].events[0].reviewed).toBe(
      true,
    )
    const demo = new MonitoringEngine('demo', vi.fn())
    demo.attach('demo', 'Demo')
    demo.ingest({
      deviceId: 'demo',
      source: 'demo',
      timestamp: NOW,
      kind: 'heartRate',
      value: 0,
      contact: true,
    })
    expect(engine.clearHistory()).toBe(true)
    expect(engine.snapshot().events).toEqual([])
    expect(demo.snapshot().events).toHaveLength(1)
  })
  it('mantiene separados los históricos por dispositivo', () => {
    const { engine, storage } = build()
    hr(engine, 70)
    engine.attach('other', 'Otro')
    engine.ingest({
      deviceId: 'other',
      source: 'real',
      kind: 'heartRate',
      value: 85,
      contact: true,
      timestamp: NOW,
    })
    engine.flush()
    expect(storage.load()).toHaveLength(2)
    engine.attach('watch', 'Reloj')
    expect(engine.snapshot().summaries[0].hrMin).toBe(70)
  })
  it('agregación de gráficos preserva huecos, rangos y ceros', () => {
    const values = [
      { ...emptySummary(NOW - 60000), hrSum: 140, hrCount: 2, hrMin: 60, hrMax: 80, zeros: 1 },
    ]
    const points = historySeries(values, 1, NOW)
    expect(points.find((p) => p.timestamp === NOW - 60000)).toMatchObject({
      average: 70,
      range: [60, 80],
      zero: 0,
    })
    expect(points.at(-1)?.average).toBeNull()
  })
})
