import type { BeacioDevice } from '@beacio/core'
import type { VeepooBleDate } from '@/vendor/veepoo/index.cjs'

export const VEEPOO_SERVICE = 'f0080001-0451-4000-b000-000000000000'
export const VEEPOO_NOTIFY = 'f0080002-0451-4000-b000-000000000000'
export const VEEPOO_WRITE = 'f0080003-0451-4000-b000-000000000000'

type Success<T = Record<string, never>> = (value: T) => void
type Failure = (value: { errMsg: string }) => void
type CallbackOptions<T = Record<string, never>> = { success?: Success<T>; fail?: Failure }
type DeviceOptions<T = Record<string, never>> = CallbackOptions<T> & { deviceId: string }
type CharacteristicOptions<T = Record<string, never>> = DeviceOptions<T> & {
  serviceId: string
  characteristicId: string
}

export interface VeepooTransport {
  createBLEConnection(options: DeviceOptions): void
  getBLEDeviceServices(
    options: DeviceOptions<{ services: Array<{ uuid: string; isPrimary: boolean }> }>,
  ): void
  getBLEDeviceCharacteristics(
    options: DeviceOptions<{
      characteristics: Array<{
        uuid: string
        properties: Record<string, boolean>
      }>
    }> & { serviceId: string },
  ): void
  notifyBLECharacteristicValueChange(options: CharacteristicOptions & { state: boolean }): void
  writeBLECharacteristicValue(
    options: CharacteristicOptions & { value: ArrayBuffer; writeNoResponse?: boolean },
  ): void
  onBLECharacteristicValueChange(callback: (event: Record<string, unknown>) => void): void
  offBLECharacteristicValueChange(): void
  onBLEConnectionStateChange(callback: (event: Record<string, unknown>) => void): void
  getBLEMTU(options: DeviceOptions<{ mtu: number }>): void
  setBLEMTU(options: DeviceOptions<{ mtu: number }> & { mtu: number }): void
  getSetting(options: CallbackOptions<{ bluetoothEnabled: boolean }>): void
  getSystemInfo(options: CallbackOptions<{ platform: string }>): void
  getSystemInfoSync(): { platform: string }
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
  removeStorageSync(key: string): void
}

export interface PreparedVeepooTransport extends VeepooTransport {
  prepareMainChannel(): Promise<VeepooBleDate>
  waitUntilNotificationsReady(): Promise<void>
}

declare global {
  // The upstream SDK still reads this compatibility surface in two protocol helpers.
  // It is deliberately limited to the active, local Web Bluetooth transport.
  var wx: VeepooTransport | undefined
}

const uppercaseUuid = (uuid: string) => uuid.toUpperCase()
const failure = (error: unknown) => ({
  errMsg: error instanceof Error ? error.message : 'Falló la operación Bluetooth',
})
const copyBuffer = (source: ArrayBufferView) =>
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer

export const detectVeepooPlatform = (
  platform = navigator.platform ?? '',
  userAgent = navigator.userAgent ?? '',
): 'ios' | 'android' =>
  /Mac|iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`) ? 'ios' : 'android'

export class WebBluetoothVeepooTransport implements PreparedVeepooTransport {
  private readonly services = new Map<string, BluetoothRemoteGATTService>()
  private readonly characteristics = new Map<string, BluetoothRemoteGATTCharacteristic>()
  private readonly storage = new Map<string, unknown>()
  private valueCallback: ((event: Record<string, unknown>) => void) | null = null
  private connectionCallback: ((event: Record<string, unknown>) => void) | null = null
  private readonly notificationHandlers = new Map<
    BluetoothRemoteGATTCharacteristic,
    (event: Event) => void
  >()
  private readonly pendingWrites = new Set<Promise<unknown>>()
  private mtu = 23
  private notificationsReady: Promise<void>
  private resolveNotificationsReady!: () => void
  private rejectNotificationsReady!: (error: Error) => void

  constructor(private readonly device: BeacioDevice) {
    this.notificationsReady = new Promise<void>((resolve, reject) => {
      this.resolveNotificationsReady = resolve
      this.rejectNotificationsReady = reject
    })
    this.device.raw.addEventListener('gattserverdisconnected', this.handleDisconnect)
  }

  private readonly handleDisconnect = () => {
    this.connectionCallback?.({ deviceId: this.device.id, connected: false })
  }

  private settle<T>(promise: Promise<T>, options: CallbackOptions<T>) {
    void promise.then((value) => options.success?.(value)).catch((error) => options.fail?.(failure(error)))
  }

  private characteristic(serviceId: string, characteristicId: string) {
    return this.characteristics.get(`${serviceId.toLowerCase()}/${characteristicId.toLowerCase()}`)
  }

  private indexCharacteristics(
    serviceId: string,
    characteristics: BluetoothRemoteGATTCharacteristic[],
  ) {
    const normalizedService = serviceId.toLowerCase()
    characteristics.forEach((characteristic) =>
      this.characteristics.set(
        `${normalizedService}/${characteristic.uuid.toLowerCase()}`,
        characteristic,
      ),
    )
    if (normalizedService !== VEEPOO_SERVICE) return
    const exactNotify = characteristics.find(
        (characteristic) =>
          characteristic.uuid.toLowerCase() === VEEPOO_NOTIFY &&
          (characteristic.properties.notify || characteristic.properties.indicate),
      )
    const exactWrite = characteristics.find(
        (characteristic) =>
          characteristic.uuid.toLowerCase() === VEEPOO_WRITE &&
          (characteristic.properties.write || characteristic.properties.writeWithoutResponse),
      )
    const notifyCandidates = characteristics.filter(
      (characteristic) => characteristic.properties.notify || characteristic.properties.indicate,
    )
    const writeCandidates = characteristics.filter(
      (characteristic) =>
        characteristic.properties.write || characteristic.properties.writeWithoutResponse,
    )
    const notify = exactNotify ?? (notifyCandidates.length === 1 ? notifyCandidates[0] : undefined)
    const write = exactWrite ?? (writeCandidates.length === 1 ? writeCandidates[0] : undefined)
    if (notify) this.characteristics.set(`${normalizedService}/${VEEPOO_NOTIFY}`, notify)
    if (write) this.characteristics.set(`${normalizedService}/${VEEPOO_WRITE}`, write)
  }

  async prepareMainChannel(): Promise<VeepooBleDate> {
    const services = await this.device.getPrimaryServices()
    services.forEach((service) => this.services.set(service.uuid.toLowerCase(), service))
    const service = this.services.get(VEEPOO_SERVICE)
    if (!service) throw new Error('El servicio principal de Veepoo no está disponible.')
    const characteristics = await service.getCharacteristics()
    this.indexCharacteristics(VEEPOO_SERVICE, characteristics)
    const notify = this.characteristic(VEEPOO_SERVICE, VEEPOO_NOTIFY)
    const write = this.characteristic(VEEPOO_SERVICE, VEEPOO_WRITE)
    if (!notify) throw new Error('La característica de notificación Veepoo no está disponible.')
    if (!write) throw new Error('La característica de escritura Veepoo no está disponible.')
    return {
      deviceId: this.device.id,
      serviceId: VEEPOO_SERVICE.toUpperCase(),
      notifyCharacteristicId: notify.uuid.toUpperCase(),
      writeCharacteristicId: write.uuid.toUpperCase(),
    }
  }

  waitUntilNotificationsReady() {
    return this.notificationsReady
  }

  private async resolveCharacteristic(
    serviceId: string,
    characteristicId: string,
    capability: 'notify' | 'write',
  ) {
    const cached = this.characteristic(serviceId, characteristicId)
    if (cached) return cached
    let service = this.services.get(serviceId.toLowerCase())
    if (!service) {
      const services = await this.device.getPrimaryServices()
      services.forEach((candidate) => this.services.set(candidate.uuid.toLowerCase(), candidate))
      service = this.services.get(serviceId.toLowerCase())
    }
    if (!service) throw new Error('El servicio Veepoo no está disponible.')
    const characteristics = await service.getCharacteristics()
    this.indexCharacteristics(serviceId, characteristics)
    const resolved = this.characteristic(serviceId, characteristicId)
    if (!resolved)
      throw new Error(
        capability === 'notify'
          ? 'La característica de notificación Veepoo no está disponible.'
          : 'La característica de escritura Veepoo no está disponible.',
      )
    return resolved
  }

  createBLEConnection(options: DeviceOptions) {
    this.settle(this.device.connect().then(() => ({})), options)
  }

  getBLEDeviceServices(
    options: DeviceOptions<{ services: Array<{ uuid: string; isPrimary: boolean }> }>,
  ) {
    this.settle(
      this.device.getPrimaryServices().then((services) => {
        services.forEach((service) => this.services.set(service.uuid.toLowerCase(), service))
        return {
          services: services.map((service) => ({ uuid: uppercaseUuid(service.uuid), isPrimary: true })),
        }
      }),
      options,
    )
  }

  getBLEDeviceCharacteristics(
    options: DeviceOptions<{
      characteristics: Array<{ uuid: string; properties: Record<string, boolean> }>
    }> & { serviceId: string },
  ) {
    const service = this.services.get(options.serviceId.toLowerCase())
    if (!service) {
      options.fail?.({ errMsg: 'El servicio Veepoo no está disponible.' })
      return
    }
    this.settle(
      service.getCharacteristics().then((characteristics) => {
        this.indexCharacteristics(options.serviceId, characteristics)
        return {
          characteristics: characteristics.map((characteristic) => ({
            uuid: uppercaseUuid(characteristic.uuid),
            properties: {
              read: characteristic.properties.read,
              write: characteristic.properties.write,
              writeNoResponse: characteristic.properties.writeWithoutResponse,
              notify: characteristic.properties.notify,
              indicate: characteristic.properties.indicate,
            },
          })),
        }
      }),
      options,
    )
  }

  notifyBLECharacteristicValueChange(options: CharacteristicOptions & { state: boolean }) {
    const operation = this.resolveCharacteristic(options.serviceId, options.characteristicId, 'notify').then(
        async (characteristic) => {
          const existing = this.notificationHandlers.get(characteristic)
          if (!options.state) {
            if (existing)
              characteristic.removeEventListener('characteristicvaluechanged', existing)
            this.notificationHandlers.delete(characteristic)
            await characteristic.stopNotifications()
            return {}
          }
          const handler = (event: Event) => {
            const source = event.target as BluetoothRemoteGATTCharacteristic
            if (!source.value) return
            this.valueCallback?.({
              deviceId: this.device.id,
              serviceId: uppercaseUuid(options.serviceId),
              characteristicId: uppercaseUuid(options.characteristicId),
              value: copyBuffer(source.value),
            })
          }
          if (existing) characteristic.removeEventListener('characteristicvaluechanged', existing)
          characteristic.addEventListener('characteristicvaluechanged', handler)
          this.notificationHandlers.set(characteristic, handler)
          await characteristic.startNotifications()
          this.resolveNotificationsReady()
          return {}
        },
      )
    void operation.catch((error) =>
      this.rejectNotificationsReady(
        error instanceof Error ? error : new Error('No se pudo activar la notificación Veepoo.'),
      ),
    )
    this.settle(operation, options)
  }

  writeBLECharacteristicValue(
    options: CharacteristicOptions & { value: ArrayBuffer; writeNoResponse?: boolean },
  ) {
    const bytes = new Uint8Array(options.value)
    const chunkSize = Math.max(1, this.mtu - 3)
    const write = (async () => {
      const characteristic = await this.resolveCharacteristic(
        options.serviceId,
        options.characteristicId,
        'write',
      )
      if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse)
        throw new Error('La característica Veepoo no permite escritura.')
      const writeChunk = (chunk: ArrayBuffer) =>
        (options.writeNoResponse || !characteristic.properties.write) &&
        characteristic.properties.writeWithoutResponse
          ? characteristic.writeValueWithoutResponse(chunk)
          : characteristic.writeValueWithResponse(chunk)
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        const chunk = bytes.slice(offset, offset + chunkSize).buffer
        await writeChunk(chunk)
      }
    })()
    const tracked = write
      .then(() => options.success?.({}))
      .catch((error) => options.fail?.(failure(error)))
      .finally(() => this.pendingWrites.delete(tracked))
    this.pendingWrites.add(tracked)
  }

  onBLECharacteristicValueChange(callback: (event: Record<string, unknown>) => void) {
    this.valueCallback = callback
  }

  offBLECharacteristicValueChange() {
    this.valueCallback = null
  }

  onBLEConnectionStateChange(callback: (event: Record<string, unknown>) => void) {
    this.connectionCallback = callback
  }

  getBLEMTU(options: DeviceOptions<{ mtu: number }>) {
    this.settle(
      this.device.getEffectiveMtu().then((mtu) => {
        this.mtu = Math.max(23, mtu)
        return { mtu: this.mtu }
      }),
      options,
    )
  }

  setBLEMTU(options: DeviceOptions<{ mtu: number }> & { mtu: number }) {
    this.mtu = Math.max(23, Math.min(options.mtu, this.mtu))
    options.success?.({ mtu: this.mtu })
  }

  getSetting(options: CallbackOptions<{ bluetoothEnabled: boolean }>) {
    options.success?.({ bluetoothEnabled: true })
  }

  getSystemInfo(options: CallbackOptions<{ platform: string }>) {
    options.success?.(this.getSystemInfoSync())
  }

  getSystemInfoSync() {
    // The SDK only recognizes its native iOS/Android identifiers.
    return { platform: detectVeepooPlatform() }
  }

  getStorageSync(key: string) {
    try {
      const value = localStorage.getItem(`veepoo:${key}`)
      return value === null ? this.storage.get(key) : JSON.parse(value)
    } catch {
      return this.storage.get(key)
    }
  }

  setStorageSync(key: string, value: unknown) {
    this.storage.set(key, value)
    try {
      localStorage.setItem(`veepoo:${key}`, JSON.stringify(value))
    } catch {
      // The in-memory fallback keeps private/incognito sessions working.
    }
  }

  removeStorageSync(key: string) {
    this.storage.delete(key)
    try {
      localStorage.removeItem(`veepoo:${key}`)
    } catch {
      // Ignore storage restrictions; the in-memory entry is already gone.
    }
  }

  async dispose() {
    await Promise.allSettled(this.pendingWrites)
    await Promise.allSettled(
      [...this.notificationHandlers.entries()].map(async ([characteristic, handler]) => {
        characteristic.removeEventListener('characteristicvaluechanged', handler)
        await characteristic.stopNotifications()
      }),
    )
    this.notificationHandlers.clear()
    this.valueCallback = null
    this.connectionCallback = null
    this.device.raw.removeEventListener('gattserverdisconnected', this.handleDisconnect)
  }
}
