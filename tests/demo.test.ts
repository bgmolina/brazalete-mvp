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
  it('caída acelerada confirma 0 BPM y un único email exactamente tras cinco segundos', () => {
    const { engine, demo } = create()
    demo.setScenario('fall')
    advance(demo, NOW, 4950)
    expect(engine.snapshot().events.filter((e) => e.timestamp >= NOW)).toHaveLength(0)
    advance(demo, NOW + 4950, 50)
    const sequenceEvents = engine.snapshot().events.filter((e) => e.timestamp >= NOW)
    expect(sequenceEvents.filter((e) => e.type === 'possible-fall')).toHaveLength(1)
    expect(sequenceEvents.filter((e) => e.type === 'zero-heart-rate')).toHaveLength(1)
    expect(sequenceEvents.filter((e) => e.type === 'email-notification')).toHaveLength(1)
    expect(engine.snapshot().heartRate).toBe(0)
    advance(demo, NOW + 5000, 10_000)
    for (const type of ['possible-fall', 'zero-heart-rate', 'email-notification'] as const)
      expect(
        engine.snapshot().events.filter((e) => e.type === type && e.timestamp >= NOW),
      ).toHaveLength(1)
  })
  it('pausa, brechas y cambios de escenario reinician los cinco segundos continuos', () => {
    const { engine, demo } = create()
    demo.setScenario('fall')
    advance(demo, NOW, 2000)
    demo.pause()
    vi.advanceTimersByTime(10_000)
    demo.step()
    expect(engine.snapshot().events.filter((e) => e.timestamp >= NOW)).toHaveLength(0)
    demo.pause()
    const resumedAt = Date.now()
    advance(demo, resumedAt, 4950)
    expect(engine.snapshot().events.filter((e) => e.timestamp >= NOW)).toHaveLength(0)
    advance(demo, resumedAt + 4950, 50)
    expect(
      engine.snapshot().events.filter((e) => e.type === 'email-notification' && e.timestamp >= NOW),
    ).toHaveLength(1)

    demo.reset()
    const changedAt = Date.now()
    demo.setScenario('fall')
    advance(demo, changedAt, 2000)
    demo.setScenario('rest')
    advance(demo, changedAt + 2000, 1000)
    demo.setScenario('fall')
    const secondFallAt = Date.now()
    advance(demo, secondFallAt, 4950)
    expect(engine.snapshot().events.filter((e) => e.timestamp >= changedAt)).toHaveLength(0)
    advance(demo, secondFallAt + 4950, 50)
    expect(
      engine
        .snapshot()
        .events.filter((e) => e.type === 'email-notification' && e.timestamp >= changedAt),
    ).toHaveLength(1)
  })
  it('una brecha de señal reinicia la secuencia acelerada completa', () => {
    const { engine, demo } = create()
    demo.setScenario('fall')
    advance(demo, NOW, 2000)
    const afterGap = NOW + 3000
    vi.setSystemTime(afterGap)
    demo.step(afterGap)
    advance(demo, afterGap, 4950)
    expect(engine.snapshot().events.filter((e) => e.timestamp >= NOW)).toHaveLength(0)
    advance(demo, afterGap + 4950, 50)
    const sequenceEvents = engine.snapshot().events.filter((e) => e.timestamp >= NOW)
    expect(sequenceEvents.filter((e) => e.type === 'possible-fall')).toHaveLength(1)
    expect(sequenceEvents.filter((e) => e.type === 'zero-heart-rate')).toHaveLength(1)
    expect(sequenceEvents.filter((e) => e.type === 'email-notification')).toHaveLength(1)
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
