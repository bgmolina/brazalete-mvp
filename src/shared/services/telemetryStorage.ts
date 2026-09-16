import { z } from 'zod'
import type { DeviceHistory } from '@shared/types/monitoring'

export const TELEMETRY_KEY = 'brazalete:v1:telemetry'
export const RETENTION_MS = 24 * 60 * 60 * 1000
const finite = z.number().finite()
const nonnegative = finite.min(0)
const summary = z.object({
  timestamp: finite,
  hrSum: nonnegative,
  hrCount: nonnegative.int(),
  hrMin: nonnegative.nullable(),
  hrMax: nonnegative.nullable(),
  zeros: nonnegative.int(),
  movementSum: nonnegative,
  movementCount: nonnegative.int(),
  steps: nonnegative.int(),
})
const event = z.object({
  id: z.string(),
  deviceId: z.string(),
  source: z.literal('real'),
  timestamp: finite,
  type: z.enum(['zero-heart-rate', 'possible-fall', 'disconnected']),
  reviewed: z.boolean(),
  evidence: z.string(),
})
const schema = z.object({
  version: z.literal(1),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      deviceName: z.string(),
      summaries: z.array(summary),
      events: z.array(event),
    }),
  ),
})
export function pruneHistories(histories: DeviceHistory[], now: number): DeviceHistory[] {
  return histories
    .map((h) => ({
      ...h,
      summaries: h.summaries.filter((s) => s.timestamp > now - RETENTION_MS && s.timestamp <= now),
      events: h.events.filter(
        (e) => e.timestamp > now - RETENTION_MS && e.timestamp <= now && e.source === 'real',
      ),
    }))
    .filter((h) => h.summaries.length || h.events.length)
}
export class TelemetryStorage {
  warning: string | null = null
  private memory: DeviceHistory[] = []
  private loaded = false
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {}
  load(now = Date.now()): DeviceHistory[] {
    try {
      const raw = !this.loaded ? this.storage?.getItem(TELEMETRY_KEY) : null
      this.loaded = true
      if (raw) {
        const result = schema.safeParse(JSON.parse(raw))
        if (!result.success) throw new Error('invalid-storage')
        this.memory = result.data.devices
      }
      const clean = pruneHistories(this.memory, now)
      if (JSON.stringify(clean) !== JSON.stringify(this.memory)) this.write(clean)
      this.memory = clean
    } catch {
      this.warning = 'No se pudo leer el historial local. El monitoreo puede continuar en memoria.'
    }
    return pruneHistories(this.memory, now)
  }
  save(history: DeviceHistory, now = Date.now()) {
    // Preserve the in-memory latest state if a previous write failed.
    this.memory = pruneHistories(
      [...this.memory.filter((h) => h.deviceId !== history.deviceId), history],
      now,
    )
    this.write(this.memory)
  }
  cleanup(now = Date.now()) {
    this.memory = pruneHistories(this.memory, now)
    this.write(this.memory)
  }
  clear() {
    try {
      this.storage?.removeItem(TELEMETRY_KEY)
      this.memory = []
      this.warning = null
      return true
    } catch {
      this.warning = 'El navegador no permitió limpiar el historial.'
      return false
    }
  }
  private write(devices: DeviceHistory[]) {
    try {
      if (!this.storage) throw new Error('storage-unavailable')
      this.storage.setItem(TELEMETRY_KEY, JSON.stringify({ version: 1, devices }))
      this.warning = null
    } catch {
      this.warning =
        'Almacenamiento no disponible o lleno. Las nuevas lecturas se conservan sólo en memoria.'
    }
  }
}
export function getLocalStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
