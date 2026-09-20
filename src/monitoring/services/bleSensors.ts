import type { BeacioDevice } from '@beacio/core'
import { parseHeartRate } from '@beacio/core/profiles/heart-rate'
import { getAdapters, type BleProfileConfig } from '@shared/services/bleProfiles'
import type { MonitoringEngine } from '@shared/services/MonitoringEngine'
import type { SensorKind } from '@shared/types/monitoring'
import {
  subscribeVeepooSensors,
  VeepooSessionError,
  type VeepooHeartRateControl,
} from './veepooSession'

export interface DeviceSensorOptions {
  onHeartRateControl?: (control: VeepooHeartRateControl | null) => void
}

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
  options: DeviceSensorOptions = {},
) {
  const cleanups: Array<() => void | Promise<void>> = []
  const cleanup = async () => {
    const pending = cleanups.splice(0).map((fn) => fn())
    await Promise.allSettled(pending)
  }
  const handleAbort = () => void cleanup()
  signal.addEventListener('abort', handleAbort, { once: true })
  const add = async (
    kind: SensorKind,
    service: string,
    characteristic: string,
    receive: (data: DataView) => void,
  ) => {
    if (signal.aborted) return 'cancelled' as const
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
      return 'ready' as const
    } catch (error) {
      if (signal.aborted) return 'cancelled' as const
      const code = (error as { code?: string }).code
      const unsupported = [
        'SERVICE_NOT_FOUND',
        'CHARACTERISTIC_NOT_FOUND',
        'CHARACTERISTIC_NOT_NOTIFIABLE',
        'DEVICE_NOT_FOUND',
      ].includes(code ?? '')
      engine.capability(
        kind,
        unsupported ? 'unsupported' : 'error',
      )
      return unsupported ? ('unsupported' as const) : ('error' as const)
    }
  }
  const base = () => ({ deviceId: device.id, source: 'real' as const, timestamp: Date.now() })
  const heart = await add('heartRate', 'heart_rate', 'heart_rate_measurement', (data) => {
    const hr = decodeHeartRate(data)
    engine.ingest({ ...base(), kind: 'heartRate', value: hr.bpm, contact: hr.contact })
  })
  let veepoo = false
  if (heart === 'ready') engine.protocol('standard-heart-rate', 'receiving')
  else if (heart === 'unsupported' && !signal.aborted) {
    try {
      const dispose = await subscribeVeepooSensors(device, engine, signal, {
        onHeartRateControl: options.onHeartRateControl,
      })
      cleanups.push(dispose)
      veepoo = true
    } catch (error) {
      if (!signal.aborted) {
        if (!(error instanceof VeepooSessionError) || error.code !== 'SERVICE_UNAVAILABLE')
          device.disconnect()
        engine.capability(
          'heartRate',
          error instanceof VeepooSessionError && error.code === 'SERVICE_UNAVAILABLE'
            ? 'unsupported'
            : 'error',
        )
        engine.setError(
          error instanceof Error
            ? error.message
            : 'No pudimos preparar el protocolo Veepoo del H7.',
        )
      }
    }
  }
  for (const adapter of getAdapters(profile)) {
    await add(adapter.kind, adapter.service, adapter.characteristic, (data) => {
      const value = adapter.decode(data)
      if (adapter.kind === 'acceleration' && typeof value !== 'number')
        engine.ingest({ ...base(), kind: 'acceleration', value })
      if (adapter.kind === 'steps' && typeof value === 'number')
        engine.ingest({ ...base(), kind: 'steps', value })
    })
  }
  if (!signal.aborted && !veepoo) {
    try {
      const data = await device.read('battery_service', 'battery_level')
      if (!signal.aborted) engine.ingest({ ...base(), kind: 'battery', value: data.getUint8(0) })
    } catch {
      if (!signal.aborted) engine.capability('battery', 'unsupported')
    }
  }
  engine.publish()
  return () => {
    signal.removeEventListener('abort', handleAbort)
    return cleanup()
  }
}
