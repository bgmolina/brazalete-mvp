import type { BeacioDevice } from '@beacio/core'
import type { MonitoringEngine } from '@shared/services/MonitoringEngine'
import type { VeepooEvent, VeepooSdk } from '@/vendor/veepoo/index.cjs'
import {
  WebBluetoothVeepooTransport,
  type PreparedVeepooTransport,
} from './veepooTransport'

const AUTH_TIMEOUT_MS = 12_000
const AUTH_RETRY_MS = 4_000
const MEASUREMENT_TIMEOUT_MS = 20_000
const AUTH_SUCCESS = new Set(['successfulVerification', 'passTheVerification'])
const AUTH_FAILURE = new Set(['verifyNotPass', 'setupFailed', 'readFailed'])

export type VeepooSdkLoader = () => Promise<VeepooSdk>
export interface ManagedVeepooTransport extends PreparedVeepooTransport {
  dispose(): Promise<void>
}
export type VeepooTransportFactory = (
  device: BeacioDevice,
) => ManagedVeepooTransport
export interface VeepooHeartRateControl {
  requestMeasurement(): void
}

export const loadVeepooSdk: VeepooSdkLoader = async () => {
  const module = await import('virtual:veepoo-sdk')
  return module.default
}

let testLoader: VeepooSdkLoader | null = null

/** Test fixture seam; production always leaves this unset and loads the pinned SDK lazily. */
export function setVeepooSdkLoaderForTests(loader: VeepooSdkLoader | null) {
  testLoader = loader
}

export class VeepooSessionError extends Error {
  constructor(
    readonly code:
      | 'AUTHENTICATION_FAILED'
      | 'AUTHENTICATION_TIMEOUT'
      | 'AUTHENTICATION_INVALID_RESPONSE'
      | 'SERVICE_UNAVAILABLE'
      | 'NOTIFICATION_UNAVAILABLE'
      | 'CHARACTERISTIC_NOT_WRITABLE'
      | 'SDK_LOAD_FAILED'
      | 'SESSION_ABORTED',
    message: string,
  ) {
    super(message)
    this.name = 'VeepooSessionError'
  }
}

const numeric = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export function readVeepooBattery(content: Record<string, unknown> | undefined) {
  if (!content) return null
  return numeric(content.VPDeviceElectricPercent)
}

export function normalizeVeepooAuthentication(content: Record<string, unknown> | undefined) {
  const acknowledgement = content?.VPDeviceAck
  const legacyStatus = content?.VPDevicepassword
  const status =
    typeof acknowledgement === 'string'
      ? acknowledgement
      : typeof legacyStatus === 'string' &&
          (AUTH_SUCCESS.has(legacyStatus) || AUTH_FAILURE.has(legacyStatus))
        ? legacyStatus
        : null
  if (status && AUTH_SUCCESS.has(status)) return 'success' as const
  if (status && AUTH_FAILURE.has(status)) return 'rejected' as const
  return 'invalid' as const
}

export function processVeepooHeartEvent(
  content: Record<string, unknown> | undefined,
  deviceId: string,
  engine: MonitoringEngine,
) {
  if (!content) return false
  engine.preparation('receiving')
  if (content.deviceBusy === true) {
    engine.capability('heartRate', 'waiting')
    engine.setError('El H7 está ocupado con otra medición. Detenela en el reloj e intentá nuevamente.')
    return false
  }
  if (content.notWear === true) {
    engine.capability('heartRate', 'waiting')
    engine.contactStatus(false)
    engine.setError('El H7 no detecta contacto con la piel. Ajustá el brazalete para medir el pulso.')
    return false
  }
  const heartRate = numeric(content.heartRate)
  if (heartRate === null || !Number.isInteger(heartRate) || heartRate < 30 || heartRate > 250) {
    engine.capability('heartRate', 'waiting')
    return false
  }
  engine.setError(null)
  engine.capability('heartRate', 'available')
  engine.ingest({
    deviceId,
    source: 'real',
    timestamp: Date.now(),
    kind: 'heartRate',
    value: heartRate,
    contact: true,
  })
  return true
}

const waitWithTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeout: () => Error,
  signal: AbortSignal,
) =>
  new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new VeepooSessionError('SESSION_ABORTED', 'Sesión cancelada'))
      return
    }
    let settled = false
    const finish = (action: (value: T | PromiseLike<T>) => void, value: T) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      action(value)
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(error)
    }
    const timer = window.setTimeout(() => fail(timeout()), timeoutMs)
    const abort = () => fail(new VeepooSessionError('SESSION_ABORTED', 'Sesión cancelada'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then((value) => finish(resolve, value), fail)
  })

export async function subscribeVeepooSensors(
  device: BeacioDevice,
  engine: MonitoringEngine,
  signal: AbortSignal,
  options: {
    loadSdk?: VeepooSdkLoader
    createTransport?: VeepooTransportFactory
    authenticationTimeoutMs?: number
    measurementTimeoutMs?: number
    onHeartRateControl?: (control: VeepooHeartRateControl | null) => void
  } = {},
) {
  engine.protocol('veepoo', 'authenticating')
  engine.capability('heartRate', 'waiting')
  engine.capability('acceleration', 'unsupported')
  engine.capability('steps', 'unsupported')

  const transport = (options.createTransport ?? ((target) => new WebBluetoothVeepooTransport(target)))(
    device,
  )
  globalThis.wx = transport
  let sdk: VeepooSdk | null = null
  const releaseTransport = async () => {
    try {
      sdk?.veepooBle.resetBleTransport()
    } catch {
      // Cleanup is best-effort; a broken SDK reset must not retain GATT listeners.
    }
    try {
      await transport.dispose()
    } finally {
      if (globalThis.wx === transport) globalThis.wx = undefined
    }
  }
  let bleDate
  try {
    bleDate = await transport.prepareMainChannel()
    sdk = await (options.loadSdk ?? testLoader ?? loadVeepooSdk)()
  } catch (error) {
    await releaseTransport()
    const detail = error instanceof Error ? error.message.toLowerCase() : ''
    if (detail.includes('notificación') || detail.includes('notification'))
      throw new VeepooSessionError(
        'NOTIFICATION_UNAVAILABLE',
        'El H7 no expone un canal de notificaciones Veepoo inequívoco.',
      )
    if (detail.includes('escritura') || detail.includes('write'))
      throw new VeepooSessionError(
        'CHARACTERISTIC_NOT_WRITABLE',
        'El servicio Veepoo está presente, pero no expone un canal de escritura inequívoco.',
      )
    if (detail.includes('servicio') || detail.includes('service'))
      throw new VeepooSessionError(
        'SERVICE_UNAVAILABLE',
        'La pulsera no expone pulso estándar ni el servicio principal de Veepoo.',
      )
    throw new VeepooSessionError(
      'SDK_LOAD_FAILED',
      'No pudimos iniciar el protocolo Veepoo del H7. Recargá la página e intentá nuevamente.',
    )
  }

  let measurementStarted = false
  let disposed = false
  let measurementTimer: number | null = null
  let authenticationRetryTimer: number | null = null
  let authenticationFinished = false
  const clearAuthenticationRetry = () => {
    if (authenticationRetryTimer !== null) window.clearTimeout(authenticationRetryTimer)
    authenticationRetryTimer = null
  }
  const clearMeasurementTimer = () => {
    if (measurementTimer !== null) window.clearTimeout(measurementTimer)
    measurementTimer = null
  }
  let resolveAuthentication!: () => void
  let rejectAuthentication!: (error: Error) => void
  const authentication = new Promise<void>((resolve, reject) => {
    resolveAuthentication = resolve
    rejectAuthentication = reject
  })

  const handleEvent = (event: VeepooEvent) => {
    if (disposed || signal.aborted) return
    if (event.type === 1) {
      authenticationFinished = true
      clearAuthenticationRetry()
      const result = normalizeVeepooAuthentication(event.content)
      if (result === 'success') resolveAuthentication()
      else if (result === 'rejected')
        rejectAuthentication(
          new VeepooSessionError(
            'AUTHENTICATION_FAILED',
            'El H7 rechazó la clave Veepoo. Verificá que conserve la clave 0000.',
          ),
        )
      else
        rejectAuthentication(
          new VeepooSessionError(
            'AUTHENTICATION_INVALID_RESPONSE',
            'El H7 respondió, pero la confirmación Veepoo no tuvo un formato reconocido. Reinicialo y volvé a conectarlo.',
          ),
        )
    } else if (event.type === 2) {
      const battery = readVeepooBattery(event.content)
      if (battery !== null && battery >= 0 && battery <= 100) {
        engine.ingest({
          deviceId: device.id,
          source: 'real',
          timestamp: Date.now(),
          kind: 'battery',
          value: battery,
        })
      }
    } else if (event.type === 51) {
      clearMeasurementTimer()
      processVeepooHeartEvent(event.content, device.id, engine)
    } else if (event.errMsg) {
      const detail = event.errMsg.toLowerCase()
      if (
        !authenticationFinished &&
        (detail.includes('notificación') || detail.includes('notification'))
      ) {
        authenticationFinished = true
        clearAuthenticationRetry()
        rejectAuthentication(
          new VeepooSessionError(
            'NOTIFICATION_UNAVAILABLE',
            'El H7 no pudo activar su canal de notificaciones Veepoo. Reinicialo y volvé a conectarlo.',
          ),
        )
      } else engine.setError(`El protocolo Veepoo informó un error: ${event.errMsg}`)
    }
  }

  try {
    try {
      sdk.veepooBle.veepooWeiXinSDKNotifyMonitorValueChange(handleEvent)
      sdk.init({ transport, bleDate })
    } catch {
      throw new VeepooSessionError(
        'SDK_LOAD_FAILED',
        'No pudimos iniciar el protocolo Veepoo del H7. Recargá la página e intentá nuevamente.',
      )
    }
    await waitWithTimeout(
      transport.waitUntilNotificationsReady().catch(() => {
        throw new VeepooSessionError(
          'NOTIFICATION_UNAVAILABLE',
          'El H7 no pudo activar su canal de notificaciones Veepoo. Reinicialo y volvé a conectarlo.',
        )
      }),
      options.authenticationTimeoutMs ?? AUTH_TIMEOUT_MS,
      () =>
        new VeepooSessionError(
          'NOTIFICATION_UNAVAILABLE',
          'El H7 no completó la activación de notificaciones Veepoo.',
        ),
      signal,
    )
    sdk.veepooFeature.veepooBlePasswordCheckManager({ isPair: false })
    if (!authenticationFinished)
      authenticationRetryTimer = window.setTimeout(() => {
        sdk.veepooFeature.veepooBlePasswordCheckManager({ isPair: false })
      }, AUTH_RETRY_MS)
    await waitWithTimeout(
      authentication,
      options.authenticationTimeoutMs ?? AUTH_TIMEOUT_MS,
      () =>
        new VeepooSessionError(
          'AUTHENTICATION_TIMEOUT',
          'El H7 no confirmó la clave Veepoo 0000. Acercá el reloj, reinicialo y volvé a conectarlo.',
        ),
      signal,
    )
    if (signal.aborted) throw new VeepooSessionError('SESSION_ABORTED', 'Sesión cancelada')
    sdk.veepooFeature.veepooReadElectricQuantityManager()
    const requestMeasurement = () => {
      if (disposed || signal.aborted) return
      clearMeasurementTimer()
      engine.setError(null)
      engine.capability('heartRate', 'waiting')
      engine.preparation('starting-measurement')
      sdk.veepooFeature.veepooSendHeartRateTestSwitchManager({ switch: true })
      measurementStarted = true
      measurementTimer = window.setTimeout(() => {
        engine.preparation('ready-to-measure')
        engine.setError(
          'El H7 está listo, pero todavía no obtuvo pulso. Ajustalo sobre la piel, apoyá el brazo y volvé a medir.',
        )
      }, options.measurementTimeoutMs ?? MEASUREMENT_TIMEOUT_MS)
    }
    options.onHeartRateControl?.({ requestMeasurement })
    requestMeasurement()
  } catch (error) {
    disposed = true
    clearAuthenticationRetry()
    options.onHeartRateControl?.(null)
    await releaseTransport()
    throw error
  }

  const dispose = async () => {
    if (disposed) return
    disposed = true
    clearAuthenticationRetry()
    clearMeasurementTimer()
    options.onHeartRateControl?.(null)
    try {
      if (measurementStarted)
        sdk.veepooFeature.veepooSendHeartRateTestSwitchManager({ switch: false })
    } finally {
      await releaseTransport()
    }
  }
  signal.addEventListener('abort', () => void dispose(), { once: true })
  return dispose
}
