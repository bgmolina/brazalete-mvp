import { describe, expect, it } from 'vitest'
import { FallDetector, StepCounter } from '@shared/utils/detection'
const point = (timestamp: number, z = 1, x = 0) => ({
  timestamp,
  x,
  y: 0,
  z,
  magnitude: Math.hypot(x, z),
})
function warm(detector: FallDetector, hz = 20) {
  for (let t = 0; t <= 1500; t += 1000 / hz) detector.push(point(t))
}
function follow(detector: FallDetector, start = 1600, x: (t: number) => number = () => 0) {
  const events = []
  for (let t = start; t <= 11_600; t += 50) {
    const result = detector.push(point(t, 1, x(t)))
    if (result) events.push(result)
  }
  return events
}
describe('Detección experimental de caída', () => {
  it('requiere impacto y diez segundos continuos de baja variación', () => {
    const detector = new FallDetector(true)
    warm(detector)
    expect(detector.ready).toBe(true)
    detector.push(point(1550, 3))
    expect(detector.pending).toBe(true)
    expect(follow(detector)).toEqual([{ peak: 3, duration: 10000 }])
  })
  it('no confunde movimiento normal ni reposo con caída', () => {
    const detector = new FallDetector(true)
    warm(detector)
    expect(follow(detector, 1550, (t) => 0.3 * Math.sin(t / 100))).toEqual([])
  })
  it('cancela si tras el impacto continúa el movimiento', () => {
    const detector = new FallDetector(true)
    warm(detector)
    detector.push(point(1550, 3))
    expect(follow(detector, 1600, (t) => Math.sin(t / 100))).toEqual([])
  })
  it('un corte de señal no cuenta como inmovilidad', () => {
    const detector = new FallDetector(true)
    warm(detector)
    detector.push(point(1550, 3))
    detector.expire(1800)
    expect(detector.pending).toBe(false)
    expect(follow(detector, 2000)).toEqual([])
  })
  it('cancela al recibir una muestra después de una brecha', () => {
    const detector = new FallDetector(true)
    warm(detector)
    detector.push(point(1550, 3))
    expect(follow(detector, 1800)).toEqual([])
  })
  it('no habilita inferencia sin calibración o con frecuencia insuficiente', () => {
    const uncalibrated = new FallDetector(false)
    warm(uncalibrated)
    expect(uncalibrated.ready).toBe(false)
    const slow = new FallDetector(true)
    warm(slow, 10)
    expect(slow.ready).toBe(false)
    slow.push(point(1600, 3))
    expect(follow(slow, 1700)).toEqual([])
  })
  it('no repite eventos durante sesenta segundos', () => {
    const detector = new FallDetector(true)
    warm(detector)
    detector.push(point(1550, 3))
    expect(follow(detector)).toHaveLength(1)
    detector.push(point(11650, 3))
    expect(detector.pending).toBe(false)
  })
  it('timestamps repetidos invalidan la continuidad', () => {
    const detector = new FallDetector(true)
    warm(detector)
    detector.push(point(1550, 3))
    detector.push(point(1550))
    expect(detector.ready).toBe(false)
    expect(detector.pending).toBe(false)
  })
})
describe('Contador de pasos por incrementos', () => {
  it('establece base, suma incrementos y detecta reinicio', () => {
    const counter = new StepCounter()
    expect(counter.push(500)).toBe(0)
    expect(counter.push(503)).toBe(3)
    expect(counter.push(503)).toBe(0)
    expect(counter.push(1)).toBe(0)
    expect(counter.push(4)).toBe(3)
    counter.resetBaseline()
    expect(counter.push(400)).toBe(0)
  })
  it('ignora valores no válidos sin alterar la base', () => {
    const counter = new StepCounter()
    counter.push(10)
    for (const value of [-1, NaN, Infinity, 10.5]) expect(counter.push(value)).toBe(0)
    expect(counter.push(12)).toBe(2)
  })
})
