import {
  EMPTY_CAPABILITIES,
  type AccelPoint,
  type CapabilityStatus,
  type ConnectionStatus,
  type DeviceProtocol,
  type DeviceHistory,
  type EventType,
  type HeartPoint,
  type MinuteSummary,
  type Mode,
  type MonitoringSnapshot,
  type PreparationPhase,
  type SensorKind,
  type SensorReading,
} from '@shared/types/monitoring'
import { FallDetector, magnitude, deviation, StepCounter } from '@shared/utils/detection'
import { RETENTION_MS, type TelemetryStorage } from './telemetryStorage'

export const emptySummary = (timestamp: number): MinuteSummary => ({
  timestamp,
  hrSum: 0,
  hrCount: 0,
  hrMin: null,
  hrMax: null,
  zeros: 0,
  movementSum: 0,
  movementCount: 0,
  steps: 0,
})

export class MonitoringEngine {
  private value: MonitoringSnapshot
  private summaries = new Map<number, MinuteSummary>()
  private detector = new FallDetector(false)
  private stepCounter = new StepCounter()
  private zeroEpisode = false
  private lastFlush = 0
  private dirty = false
  private lastCleanup = 0
  private lastAccelAt = 0
  private recentMotion: AccelPoint[] = []
  constructor(
    readonly source: Mode,
    private notify: (snapshot: MonitoringSnapshot) => void,
    private storage?: TelemetryStorage,
  ) {
    this.value = {
      deviceId: null,
      deviceName: '',
      connection: 'disconnected',
      protocol: null,
      preparation: 'idle',
      capabilities: { ...EMPTY_CAPABILITIES },
      heartRate: null,
      contact: null,
      lastHeartAt: null,
      battery: null,
      steps: 0,
      motion: 'unknown',
      fallReady: false,
      fallPending: false,
      heartPoints: [],
      acceleration: [],
      summaries: [],
      events: [],
      error: null,
      storageWarning: null,
      paused: false,
      now: Date.now(),
    }
    const histories = storage?.load() ?? []
    const lastTimestamp = (history: DeviceHistory) =>
      [...history.summaries, ...history.events].reduce(
        (last, item) => Math.max(last, item.timestamp),
        0,
      )
    const latest = histories.sort((a, b) => lastTimestamp(b) - lastTimestamp(a))[0]
    if (latest) this.restore(latest)
  }
  snapshot(): MonitoringSnapshot {
    const cutoff =
      this.source === 'real' ? Math.max(this.value.now, Date.now()) - RETENTION_MS : -Infinity
    return {
      ...this.value,
      capabilities: { ...this.value.capabilities },
      heartPoints: [...this.value.heartPoints],
      acceleration: [...this.value.acceleration],
      summaries: [...this.summaries.values()]
        .filter((s) => s.timestamp > cutoff)
        .map((s) => ({ ...s }))
        .sort((a, b) => a.timestamp - b.timestamp),
      events: this.value.events.filter((e) => e.timestamp > cutoff),
      storageWarning: this.storage?.warning ?? null,
    }
  }
  publish() {
    this.notify(this.snapshot())
  }
  private restore(history: DeviceHistory) {
    this.value.deviceId = history.deviceId
    this.value.deviceName = history.deviceName
    this.value.events = history.events
    this.summaries = new Map(history.summaries.map((s) => [s.timestamp, s]))
  }
  attach(deviceId: string, deviceName: string, calibrated = false) {
    if (this.value.deviceId !== deviceId) {
      this.flush()
      this.summaries.clear()
      this.value.events = []
      this.value.steps = 0
      const old = this.storage?.load().find((h) => h.deviceId === deviceId)
      if (old) this.restore(old)
      this.value.heartPoints = []
      this.value.acceleration = []
    }
    this.value.deviceId = deviceId
    this.value.deviceName = deviceName
    this.value.connection = 'connected'
    this.value.protocol = null
    this.value.preparation = 'discovering'
    this.value.error = null
    this.value.heartRate = null
    this.value.lastHeartAt = null
    this.value.contact = null
    this.value.battery = null
    this.value.capabilities = { ...EMPTY_CAPABILITIES }
    this.detector = new FallDetector(calibrated)
    this.recentMotion = []
    this.lastAccelAt = 0
    this.value.fallReady = false
    this.value.fallPending = false
    this.value.motion = 'unknown'
    this.stepCounter.resetBaseline()
    this.zeroEpisode = false
    this.publish()
  }
  capability(kind: SensorKind, status: CapabilityStatus) {
    if (this.value.capabilities[kind] !== status) {
      this.value.capabilities[kind] = status
      this.publish()
    }
  }
  protocol(protocol: DeviceProtocol, preparation: PreparationPhase = 'discovering') {
    this.value.protocol = protocol
    this.value.preparation = preparation
    this.publish()
  }
  preparation(preparation: PreparationPhase) {
    if (this.value.preparation !== preparation) {
      this.value.preparation = preparation
      this.publish()
    }
  }
  contactStatus(contact: boolean | null) {
    this.value.contact = contact
    this.publish()
  }
  connection(status: ConnectionStatus, error: string | null = null, unexpected = false) {
    const previous = this.value.connection
    this.value.connection = status
    this.value.error = error
    if (status !== 'connected') {
      this.value.protocol = null
      this.value.preparation = 'idle'
      this.detector.reset()
      this.recentMotion = []
      this.stepCounter.resetBaseline()
      this.zeroEpisode = false
      this.value.fallReady = false
      this.value.fallPending = false
      this.value.motion = 'unknown'
      if (previous === 'connected' && this.value.heartPoints.length)
        this.value.heartPoints.push({ timestamp: Date.now(), bpm: null, quality: 'unknown' })
    }
    if (unexpected && previous === 'connected')
      this.event(
        'disconnected',
        'Se interrumpió el enlace Bluetooth. No equivale a una lectura de 0 BPM.',
      )
    this.publish()
  }
  setError(error: string | null) {
    this.value.error = error
    this.publish()
  }
  setPaused(paused: boolean) {
    this.value.paused = paused
    this.publish()
  }
  ingest(reading: SensorReading) {
    if (
      reading.deviceId !== this.value.deviceId ||
      reading.source !== this.source ||
      this.value.connection !== 'connected'
    )
      return
    if (!Number.isFinite(reading.timestamp) || reading.timestamp > Date.now() + 5000) return
    const t = Math.floor(reading.timestamp / 60_000) * 60_000
    const summary = this.summaries.get(t) ?? emptySummary(t)
    if (reading.kind === 'heartRate') {
      if (
        !Number.isInteger(reading.value) ||
        reading.value < 0 ||
        reading.value > 65535 ||
        (this.value.lastHeartAt !== null && reading.timestamp < this.value.lastHeartAt)
      )
        return
      const quality =
        reading.contact === false ? 'no-contact' : reading.contact === null ? 'unknown' : 'valid'
      if (this.value.lastHeartAt !== null && reading.timestamp - this.value.lastHeartAt >= 10000) {
        if (this.value.heartPoints.at(-1)?.bpm !== null)
          this.value.heartPoints.push({
            timestamp: this.value.lastHeartAt + 10000,
            bpm: null,
            quality: 'unknown',
          })
        this.zeroEpisode = false
      }
      this.value.heartRate = reading.value
      this.value.contact = reading.contact
      this.value.lastHeartAt = reading.timestamp
      const point: HeartPoint = { timestamp: reading.timestamp, bpm: reading.value, quality }
      this.value.heartPoints.push(point)
      this.value.heartPoints = this.value.heartPoints
        .filter((p) => p.timestamp >= reading.timestamp - 600_000)
        .slice(-6000)
      if (reading.value > 0 && reading.contact !== false) {
        summary.hrSum += reading.value
        summary.hrCount++
        summary.hrMin = Math.min(summary.hrMin ?? Infinity, reading.value)
        summary.hrMax = Math.max(summary.hrMax ?? 0, reading.value)
        this.zeroEpisode = false
      }
      if (reading.value === 0) {
        summary.zeros++
        this.summaries.set(t, summary)
        if (!this.zeroEpisode) {
          this.zeroEpisode = true
          this.event(
            'zero-heart-rate',
            `El dispositivo reportó 0 BPM. Contacto: ${reading.contact === null ? 'no informado' : reading.contact ? 'detectado' : 'no detectado'}. Verificá la medición y a la persona.`,
            reading.timestamp,
          )
        }
      } else this.zeroEpisode = false
    } else if (reading.kind === 'acceleration') {
      const a = reading.value
      if (![a.x, a.y, a.z].every(Number.isFinite) || reading.timestamp < this.lastAccelAt) return
      const point: AccelPoint = { ...a, timestamp: reading.timestamp, magnitude: magnitude(a) }
      this.value.acceleration.push(point)
      this.value.acceleration = this.value.acceleration.slice(-200)
      this.recentMotion.push(point)
      this.recentMotion = this.recentMotion.filter((p) => p.timestamp >= reading.timestamp - 2000)
      const motion = Math.max(
        ...(['x', 'y', 'z'] as const).map((axis) =>
          deviation(this.recentMotion.map((p) => p[axis])),
        ),
      )
      this.value.motion =
        this.recentMotion.length < 2 ? 'unknown' : motion > 0.1 ? 'moving' : 'rest'
      summary.movementSum += motion
      summary.movementCount++
      this.lastAccelAt = reading.timestamp
      const fall = this.detector.push(point)
      if (fall)
        this.event(
          'possible-fall',
          `Detección experimental: impacto de ${fall.peak.toFixed(2)} g seguido de ${Math.round(fall.duration / 1000)} s de baja variación. Requiere verificación presencial.`,
          reading.timestamp,
        )
      this.value.fallReady = this.detector.ready
      this.value.fallPending = this.detector.pending
    } else if (reading.kind === 'steps') {
      if (!Number.isSafeInteger(reading.value) || reading.value < 0) return
      const increment = this.stepCounter.push(reading.value)
      this.value.steps += increment
      summary.steps += increment
    } else {
      if (!Number.isFinite(reading.value) || reading.value < 0 || reading.value > 100) return
      this.value.battery = reading.value
    }
    this.value.capabilities[reading.kind] = 'available'
    this.summaries.set(t, summary)
    this.dirty = true
  }
  private event(type: EventType, evidence: string, timestamp = Date.now()) {
    if (!this.value.deviceId) return
    const previousFall = this.value.events.find((e) => e.type === 'possible-fall')
    if (type === 'possible-fall' && previousFall && timestamp - previousFall.timestamp < 60_000)
      return
    this.value.events = [
      {
        id: crypto.randomUUID(),
        deviceId: this.value.deviceId,
        source: this.source,
        timestamp,
        type,
        evidence,
        reviewed: false,
      },
      ...this.value.events,
    ].sort((a, b) => b.timestamp - a.timestamp)
    this.dirty = true
    this.flush()
    this.publish()
  }
  review(id: string) {
    this.value.events = this.value.events.map((e) => (e.id === id ? { ...e, reviewed: true } : e))
    this.dirty = true
    this.flush()
    this.publish()
  }
  tick(now = Date.now()) {
    this.value.now = now
    this.detector.expire(now)
    this.value.fallReady = this.detector.ready
    this.value.fallPending = this.detector.pending
    if (now - this.lastAccelAt > 2000) this.value.motion = 'unknown'
    if (
      this.value.lastHeartAt &&
      now - this.value.lastHeartAt >= 10_000 &&
      this.value.heartPoints.at(-1)?.bpm !== null
    ) {
      this.value.heartPoints.push({
        timestamp: this.value.lastHeartAt + 10_000,
        bpm: null,
        quality: 'unknown',
      })
      this.zeroEpisode = false
    }
    this.value.heartPoints = this.value.heartPoints.filter((p) => p.timestamp >= now - 600_000)
    if (this.source === 'real' && now - this.lastCleanup >= 60_000) {
      this.summaries = new Map([...this.summaries].filter(([t]) => t > now - RETENTION_MS))
      this.value.events = this.value.events.filter((e) => e.timestamp > now - RETENTION_MS)
      this.storage?.cleanup(now)
      this.lastCleanup = now
      this.dirty = true
    }
    if (now - this.lastFlush >= 5000) this.flush(now)
    this.publish()
  }
  flush(now = Date.now()) {
    if (this.source === 'real' && this.value.deviceId && this.dirty) {
      this.storage?.save(
        {
          deviceId: this.value.deviceId,
          deviceName: this.value.deviceName,
          summaries: [...this.summaries.values()],
          events: this.value.events,
        },
        now,
      )
      this.dirty = false
    }
    this.lastFlush = now
  }
  clearHistory() {
    if (this.storage && !this.storage.clear()) {
      this.publish()
      return false
    }
    this.summaries.clear()
    this.value.events = []
    this.value.heartPoints = []
    this.value.acceleration = []
    this.value.steps = 0
    this.stepCounter.resetBaseline()
    this.detector.reset()
    this.recentMotion = []
    this.zeroEpisode = false
    this.value.fallReady = false
    this.value.fallPending = false
    this.value.motion = 'unknown'
    this.dirty = false
    this.publish()
    return true
  }
  seed(history: DeviceHistory, points: HeartPoint[], steps: number) {
    this.restore(history)
    this.value.heartPoints = points
    this.value.steps = steps
    this.publish()
  }
  addDemoEvent(type: EventType, evidence: string, timestamp: number) {
    if (this.source === 'demo') this.event(type, evidence, timestamp)
  }
}
