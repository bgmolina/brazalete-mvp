import type { AccelPoint } from '@shared/types/monitoring'

// Experimental engineering defaults. Not a clinically validated fall detector.
export const DETECTION = {
  impactG: 2.5,
  stillnessMs: 10_000,
  maxDeviationG: 0.1,
  minHz: 20,
  maxGapMs: 150,
  cooldownMs: 60_000,
} as const
export const magnitude = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z)
export function deviation(values: number[]) {
  if (!values.length) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}
export class FallDetector {
  private recent: AccelPoint[] = []
  private candidate: { timestamp: number; peak: number; samples: AccelPoint[] } | null = null
  private lastEvent = -Infinity
  private lastAt: number | null = null
  constructor(private readonly calibrated: boolean) {}
  get ready() {
    if (!this.calibrated || this.recent.length < 20) return false
    const span = this.recent.at(-1)!.timestamp - this.recent[0].timestamp
    return span >= 900 && ((this.recent.length - 1) * 1000) / span >= DETECTION.minHz
  }
  get pending() {
    return this.candidate !== null
  }
  reset() {
    this.recent = []
    this.candidate = null
    this.lastAt = null
  }
  expire(now: number) {
    if (this.lastAt !== null && now - this.lastAt > DETECTION.maxGapMs) this.reset()
  }
  push(point: AccelPoint): { peak: number; duration: number } | null {
    if (
      this.lastAt !== null &&
      (point.timestamp <= this.lastAt || point.timestamp - this.lastAt > DETECTION.maxGapMs)
    )
      this.reset()
    this.lastAt = point.timestamp
    this.recent.push(point)
    this.recent = this.recent.filter((p) => p.timestamp >= point.timestamp - 1100)
    if (!this.ready) {
      this.candidate = null
      return null
    }
    if (point.magnitude >= DETECTION.impactG) {
      if (point.timestamp - this.lastEvent >= DETECTION.cooldownMs)
        this.candidate = { timestamp: point.timestamp, peak: point.magnitude, samples: [] }
      return null
    }
    const c = this.candidate
    if (!c) return null
    c.samples.push(point)
    // Reject continued movement: look at the vector, not magnitude alone.
    const moving = (['x', 'y', 'z'] as const).some(
      (axis) => deviation(c.samples.map((p) => p[axis])) > DETECTION.maxDeviationG,
    )
    if (moving) {
      this.candidate = null
      return null
    }
    if (point.timestamp - c.timestamp >= DETECTION.stillnessMs) {
      this.candidate = null
      if ((c.samples.length * 1000) / (point.timestamp - c.timestamp) < DETECTION.minHz) return null
      this.lastEvent = point.timestamp
      return { peak: c.peak, duration: point.timestamp - c.timestamp }
    }
    return null
  }
}
export class StepCounter {
  private previous: number | null = null
  resetBaseline() {
    this.previous = null
  }
  push(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) return 0
    const delta = this.previous === null || value < this.previous ? 0 : value - this.previous
    this.previous = value
    return delta
  }
}
