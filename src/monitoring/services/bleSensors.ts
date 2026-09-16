import type { BeacioDevice } from '@beacio/core'
import { parseHeartRate } from '@beacio/core/profiles/heart-rate'
import { getAdapters, type BleProfileConfig } from '@shared/services/bleProfiles'
import type { MonitoringEngine } from '@shared/services/MonitoringEngine'
import type { SensorKind } from '@shared/types/monitoring'

export function decodeHeartRate(data: DataView) {
  if (data.byteLength < 2) throw new Error('Medición incompleta')
  const flags = data.getUint8(0)
  const required = 1 + (flags & 1 ? 2 : 1) + (flags & 8 ? 2 : 0)
  if (
    data.byteLength < required ||
    (flags & 16 && (data.byteLength - required < 2 || (data.byteLength - required) % 2 !== 0))
  )
    throw new Error('Medición incompleta')
  return parseHeartRate(data)
}
export const describeBluetoothError = (error: unknown) => {
  const code = (error as { code?: string })?.code
  if (code === 'USER_CANCELLED') return null
  if (code === 'BLUETOOTH_UNAVAILABLE')
    return 'Bluetooth no está disponible. Activá el Bluetooth de la computadora.'
  if (code === 'PERMISSION_DENIED')
    return 'No se concedió acceso. Volvé a conectar y autorizá la pulsera.'
  if (code === 'DEVICE_NOT_FOUND')
    return 'No se encontró la pulsera. Acercala a la computadora e intentá nuevamente.'
  return 'No pudimos completar la conexión. Revisá la pulsera y cerrá otras apps que la estén usando.'
}

/** Sequential GATT setup with cancellation-safe teardown; SDK hooks own the connection. */
export async function subscribeDeviceSensors(
  device: BeacioDevice,
  profile: BleProfileConfig | null,
  engine: MonitoringEngine,
  signal: AbortSignal,
) {
  const cleanups: Array<() => void> = []
  const cleanup = () => {
    cleanups.splice(0).forEach((fn) => fn())
  }
  signal.addEventListener('abort', cleanup, { once: true })
  const add = async (
    kind: SensorKind,
    service: string,
    characteristic: string,
    receive: (data: DataView) => void,
  ) => {
    if (signal.aborted) return
    engine.capability(kind, 'waiting')
    try {
      const unsub = await device.subscribeAsync(service, characteristic, (data) => {
        if (signal.aborted) return
        try {
          receive(data)
        } catch {
          engine.capability(kind, 'error')
        }
      })
      if (signal.aborted) unsub()
      else cleanups.push(unsub)
    } catch (error) {
      if (signal.aborted) return
      const code = (error as { code?: string }).code
      engine.capability(
        kind,
        [
          'SERVICE_NOT_FOUND',
          'CHARACTERISTIC_NOT_FOUND',
          'CHARACTERISTIC_NOT_NOTIFIABLE',
          'DEVICE_NOT_FOUND',
        ].includes(code ?? '')
          ? 'unsupported'
          : 'error',
      )
    }
  }
  const base = () => ({ deviceId: device.id, source: 'real' as const, timestamp: Date.now() })
  await add('heartRate', 'heart_rate', 'heart_rate_measurement', (data) => {
    const hr = decodeHeartRate(data)
    engine.ingest({ ...base(), kind: 'heartRate', value: hr.bpm, contact: hr.contact })
  })
  for (const adapter of getAdapters(profile)) {
    await add(adapter.kind, adapter.service, adapter.characteristic, (data) => {
      const value = adapter.decode(data)
      if (adapter.kind === 'acceleration' && typeof value !== 'number')
        engine.ingest({ ...base(), kind: 'acceleration', value })
      if (adapter.kind === 'steps' && typeof value === 'number')
        engine.ingest({ ...base(), kind: 'steps', value })
    })
  }
  if (!signal.aborted) {
    try {
      const data = await device.read('battery_service', 'battery_level')
      if (!signal.aborted) engine.ingest({ ...base(), kind: 'battery', value: data.getUint8(0) })
    } catch {
      if (!signal.aborted) engine.capability('battery', 'unsupported')
    }
  }
  engine.publish()
  return () => {
    signal.removeEventListener('abort', cleanup)
    cleanup()
  }
}
