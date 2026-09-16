import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoSimulation } from '@monitoring/services/demo'
import { MonitoringEngine } from '@shared/services/MonitoringEngine'
const NOW = 1_800_000_000_000
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
describe('Simulación determinista y aislada', () => {
  const create = () => {
    const engine = new MonitoringEngine('demo', () => {})
    const demo = new DemoSimulation(engine)
    demo.reset()
    return { engine, demo }
  }
  const advance = (demo: DemoSimulation, from: number, duration: number) => {
    for (let t = from + 50; t <= from + duration; t += 50) {
      vi.setSystemTime(t)
      demo.step(t)
    }
  }
  it('movimiento incrementa los pasos de sesión; pausa detiene las muestras y reset restaura el ejemplo', () => {
    const { engine, demo } = create()
    demo.setScenario('moving')
    advance(demo, NOW, 2000)
    expect(engine.snapshot().steps).toBeGreaterThan(1684)
    expect(engine.snapshot().motion).toBe('moving')
    demo.pause()
    const previous = engine.snapshot().lastHeartAt
    advance(demo, NOW + 2000, 2000)
    expect(engine.snapshot().lastHeartAt).toBe(previous)
    demo.reset()
    expect(engine.snapshot().steps).toBe(1684)
    expect(engine.snapshot().events).toHaveLength(2)
    expect(demo.paused).toBe(false)
  })
  it('caída genera exactamente un evento y señal insuficiente nunca simula inmovilidad', () => {
    const { engine, demo } = create()
    demo.setScenario('fall')
    advance(demo, NOW, 13_000)
    expect(engine.snapshot().events.filter((e) => e.type === 'possible-fall')).toHaveLength(1)
    demo.reset()
    demo.setScenario('fall')
    advance(demo, Date.now(), 2000)
    demo.pause()
    vi.advanceTimersByTime(11_000)
    engine.tick()
    expect(engine.snapshot().events.filter((e) => e.type === 'possible-fall')).toHaveLength(0)
  })
  it('desconexión no genera cero; reconexión retoma sin persistir la demo', () => {
    const { engine, demo } = create()
    demo.setScenario('disconnected')
    advance(demo, NOW, 2000)
    expect(engine.snapshot().connection).toBe('disconnected')
    expect(engine.snapshot().heartRate).not.toBe(0)
    demo.setScenario('rest')
    advance(demo, NOW + 2000, 1000)
    expect(engine.snapshot().connection).toBe('connected')
    expect(engine.snapshot().heartRate).toBeGreaterThan(0)
    expect(engine.snapshot().events.every((e) => e.source === 'demo')).toBe(true)
  })
})
