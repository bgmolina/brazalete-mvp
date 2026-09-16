import { emptySummary, type MonitoringEngine } from '@shared/services/MonitoringEngine'
import type { HeartPoint, MinuteSummary } from '@shared/types/monitoring'
export type DemoScenario = 'rest' | 'moving' | 'zero' | 'fall' | 'disconnected'
const DEMO_ID = 'demo-elena-01'
export class DemoSimulation {
  scenario: DemoScenario = 'rest'
  paused = false
  private lastHeart = 0
  private lastSample = 0
  private start = 0
  private tickIndex = 0
  private counter = 1684
  constructor(private engine: MonitoringEngine) {}
  reset(now = Date.now()) {
    this.scenario = 'rest'
    this.paused = false
    this.counter = 1684
    this.tickIndex = 0
    this.start = now
    this.lastHeart = 0
    this.lastSample = 0
    this.engine.clearHistory()
    this.engine.attach(DEMO_ID, 'Brazalete · Demo', true)
    const summaries: MinuteSummary[] = []
    const minute = Math.floor(now / 60000) * 60000
    for (let i = 90 * 24; i > 24; i--) {
      const t = Math.floor(now / 3600000) * 3600000 - i * 3600000
      const hr = 70 + Math.round(7 * Math.sin(i * 0.33))
      summaries.push({
        ...emptySummary(t),
        hrSum: hr * 60,
        hrCount: 60,
        hrMin: hr - 6,
        hrMax: hr + 8,
        movementSum: (0.05 + Math.abs(Math.sin(i)) * 0.15) * 60,
        movementCount: 60,
        steps: i % 3 === 0 ? 240 : 30,
      })
    }
    for (let i = 1440; i > 0; i--) {
      const hr = 68 + Math.round(5 * Math.sin(i * 0.035) + 4 * Math.sin(i * 0.3))
      summaries.push({
        ...emptySummary(minute - i * 60000),
        hrSum: hr * 60,
        hrCount: 60,
        hrMin: hr - 3,
        hrMax: hr + 5,
        movementSum: Math.abs(Math.sin(i * 0.01)) * 0.2,
        movementCount: 1,
        steps: i % 7 === 0 ? 14 : 0,
      })
    }
    const points: HeartPoint[] = Array.from({ length: 300 }, (_, i) => ({
      timestamp: now - (300 - i) * 2000,
      bpm: 71 + Math.round(3 * Math.sin(i * 0.075) + 2 * Math.sin(i * 0.38)),
      quality: 'valid',
    }))
    this.engine.seed(
      { deviceId: DEMO_ID, deviceName: 'Brazalete · Demo', summaries, events: [] },
      points,
      1684,
    )
    this.engine.addDemoEvent(
      'zero-heart-rate',
      'Ejemplo simulado: el sensor reportó una lectura de 0 BPM. El contacto se restableció luego de ajustar la pulsera.',
      now - 42 * 60000,
    )
    this.engine.addDemoEvent(
      'disconnected',
      'Ejemplo simulado: se perdió temporalmente la conexión. La pulsera volvió a conectarse.',
      now - 98 * 60000,
    )
    this.engine.setPaused(false)
    this.step(now)
    this.engine.publish()
  }
  setScenario(scenario: DemoScenario) {
    this.scenario = scenario
    this.start = Date.now()
    this.tickIndex = 0
    if (scenario === 'disconnected') this.engine.connection('disconnected', null, true)
    else if (this.engine.snapshot().connection !== 'connected')
      this.engine.attach(DEMO_ID, 'Brazalete · Demo', true)
    this.engine.publish()
  }
  pause() {
    this.paused = !this.paused
    this.engine.setPaused(this.paused)
  }
  step(now = Date.now()) {
    if (this.paused || this.scenario === 'disconnected') return
    const end = Math.floor(now / 50) * 50
    // A deterministic 20 Hz fictional source, with bounded catch-up for timer jitter.
    // Long pauses intentionally create a gap instead of fabricating continuity.
    if (!this.lastSample || end - this.lastSample > 150) this.lastSample = end - 50
    while (this.lastSample + 50 <= end) {
      this.lastSample += 50
      this.sample(this.lastSample)
    }
  }
  private sample(now: number) {
    const base = { deviceId: DEMO_ID, source: 'demo' as const, timestamp: now }
    const elapsed = now - this.start
    const moving = this.scenario === 'moving'
    const impact = this.scenario === 'fall' && elapsed >= 1600 && elapsed < 1700
    this.engine.ingest({
      ...base,
      kind: 'acceleration',
      value: {
        x: moving ? Math.sin(this.tickIndex / 3) * 0.6 : 0.02 * Math.sin(this.tickIndex / 4),
        y: moving ? Math.cos(this.tickIndex / 3) * 0.25 : 0.01,
        z: impact ? 3.2 : 1 + (moving ? Math.sin(this.tickIndex / 2) * 0.25 : 0.005),
      },
    })
    if (now - this.lastHeart >= 1000) {
      const hr =
        this.scenario === 'zero'
          ? 0
          : (moving ? 88 : 72) + Math.round(3 * Math.sin(elapsed / 7000) + Math.sin(elapsed / 2100))
      this.engine.ingest({ ...base, kind: 'heartRate', value: hr, contact: true })
      this.engine.ingest({ ...base, kind: 'battery', value: 84 })
      this.counter += moving ? 2 : 0
      this.engine.ingest({ ...base, kind: 'steps', value: this.counter })
      this.lastHeart = now
    }
    this.tickIndex++
  }
}
