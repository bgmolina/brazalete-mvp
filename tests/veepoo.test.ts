import { Beacio, type BeacioDevice } from '@beacio/core'
import { installMockBluetooth, type MockBluetooth } from '@beacio/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VeepooEvent, VeepooSdk } from '@/vendor/veepoo/index.cjs'
import {
  processVeepooHeartEvent,
  readVeepooBattery,
  normalizeVeepooAuthentication,
  subscribeVeepooSensors,
  setVeepooSdkLoaderForTests,
  VeepooSessionError,
  type ManagedVeepooTransport,
} from '@monitoring/services/veepooSession'
import { subscribeDeviceSensors } from '@monitoring/services/bleSensors'
import {
  VEEPOO_NOTIFY,
  VEEPOO_SERVICE,
  VEEPOO_WRITE,
  WebBluetoothVeepooTransport,
  detectVeepooPlatform,
} from '@monitoring/services/veepooTransport'
import { MonitoringEngine } from '@shared/services/MonitoringEngine'
import { normalizeMockEventTargets } from './helpers/mockNotifications'

const h7Config = {
  id: 'h7-test',
  name: 'H7',
  services: [
    {
      uuid: VEEPOO_SERVICE,
      characteristics: [
        { uuid: VEEPOO_NOTIFY, properties: { notify: true } },
        { uuid: VEEPOO_WRITE, properties: { write: true, writeWithoutResponse: true } },
      ],
    },
  ],
}

const makeEngine = () => {
  const engine = new MonitoringEngine('real', () => undefined)
  engine.attach('h7-test', 'H7')
  return engine
}

const callbackPromise = <T>(
  invoke: (success: (value: T) => void, fail: (error: { errMsg: string }) => void) => void,
) =>
  new Promise<T>((resolve, reject) =>
    invoke(resolve, (error) => reject(new Error(error.errMsg))),
  )

const fakeTransport = (): ManagedVeepooTransport => ({
  prepareMainChannel: vi.fn(async () => ({
    deviceId: 'h7-test',
    serviceId: VEEPOO_SERVICE.toUpperCase(),
    notifyCharacteristicId: VEEPOO_NOTIFY.toUpperCase(),
    writeCharacteristicId: VEEPOO_WRITE.toUpperCase(),
  })),
  waitUntilNotificationsReady: vi.fn(async () => undefined),
  createBLEConnection: vi.fn(),
  getBLEDeviceServices: vi.fn(),
  getBLEDeviceCharacteristics: vi.fn(),
  notifyBLECharacteristicValueChange: vi.fn(),
  writeBLECharacteristicValue: vi.fn(),
  onBLECharacteristicValueChange: vi.fn(),
  offBLECharacteristicValueChange: vi.fn(),
  onBLEConnectionStateChange: vi.fn(),
  getBLEMTU: vi.fn(),
  setBLEMTU: vi.fn(),
  getSetting: vi.fn(),
  getSystemInfo: vi.fn(),
  getSystemInfoSync: vi.fn(() => ({ platform: 'web' })),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  dispose: vi.fn(async () => undefined),
})

const fakeSdk = (authentication: string | null = 'successfulVerification') => {
  let notify: ((event: VeepooEvent) => void) | null = null
  const heartSwitches: boolean[] = []
  const sdk: VeepooSdk = {
    init: vi.fn(({ transport, bleDate }) => {
      const bridge = transport as ManagedVeepooTransport
      if (!bleDate) return
      bridge.onBLECharacteristicValueChange(() => undefined)
      bridge.notifyBLECharacteristicValueChange({
        ...bleDate,
        characteristicId: bleDate.notifyCharacteristicId,
        state: true,
      })
    }),
    veepooBle: {
      veepooWeiXinSDKConnectionDevice: vi.fn((_device, callback) => {
        callback({ connection: true })
      }),
      veepooWeiXinSDKNotifyMonitorValueChange: vi.fn((callback) => {
        notify = callback
      }),
      resetBleTransport: vi.fn(),
    },
    veepooFeature: {
      veepooBlePasswordCheckManager: vi.fn(() => {
        if (authentication !== null)
          notify?.({
            type: 1,
            content: {
              VPDevicepassword: '0000',
              VPDeviceAck: authentication,
              VPDeviceMAC: 'D2:73:A4:F9:97:23',
            },
          })
      }),
      veepooReadElectricQuantityManager: vi.fn(),
      veepooSendHeartRateTestSwitchManager: vi.fn(({ switch: enabled }) => {
        heartSwitches.push(enabled)
      }),
    },
  }
  return { sdk, emit: (event: VeepooEvent) => notify?.(event), heartSwitches }
}

describe('Protocolo Veepoo H7', () => {
  let mock: MockBluetooth
  let restoreTargets: () => void
  let device: BeacioDevice

  beforeEach(async () => {
    restoreTargets = normalizeMockEventTargets()
    mock = installMockBluetooth({ devices: [h7Config] })
    device = await new Beacio().requestDevice({ acceptAllDevices: true })
    await device.connect()
  })

  afterEach(() => {
    mock.uninstall()
    restoreTargets()
    localStorage.clear()
    vi.restoreAllMocks()
    setVeepooSdkLoaderForTests(null)
    vi.useRealTimers()
  })

  it('carga el SDK oficial real como ESM sin depender del global Node module', async () => {
    const { default: sdk } = await import('virtual:veepoo-sdk')
    expect(sdk).toMatchObject({
      init: expect.any(Function),
      veepooBle: expect.objectContaining({
        veepooWeiXinSDKConnectionDevice: expect.any(Function),
      }),
      veepooFeature: expect.objectContaining({
        veepooSendHeartRateTestSwitchManager: expect.any(Function),
      }),
    })
  })

  it('decodifica la confirmación real del H7 desde VPDeviceAck', () => {
    expect(
      normalizeVeepooAuthentication({
        VPDevicepassword: '0000',
        VPDeviceAck: 'successfulVerification',
        VPDeviceMAC: 'D2:73:A4:F9:97:23',
      }),
    ).toBe('success')
    expect(
      normalizeVeepooAuthentication({ VPDevicepassword: '0000', VPDeviceAck: 'verifyNotPass' }),
    ).toBe('rejected')
    expect(normalizeVeepooAuthentication({ VPDevicepassword: '0000' })).toBe('invalid')
    expect(
      normalizeVeepooAuthentication({ VPDevicepassword: 'successfulVerification' }),
    ).toBe('success')
  })

  it('el SDK oficial descubre y activa la característica principal antes de autenticar', async () => {
    vi.useFakeTimers()
    const { default: sdk } = await import('virtual:veepoo-sdk')
    const notifyRequests: Array<{ serviceId: string; characteristicId: string }> = []
    const writes: Array<{ serviceId: string; characteristicId: string; value: ArrayBuffer }> = []
    const transport = fakeTransport()
    vi.mocked(transport.createBLEConnection).mockImplementation(({ success }) => success?.({}))
    vi.mocked(transport.getBLEDeviceServices).mockImplementation(({ success }) =>
      success?.({ services: [{ uuid: VEEPOO_SERVICE.toUpperCase(), isPrimary: true }] }),
    )
    vi.mocked(transport.getBLEDeviceCharacteristics).mockImplementation(({ success }) =>
      success?.({
        characteristics: [
          { uuid: VEEPOO_NOTIFY.toUpperCase(), properties: { notify: true } },
          {
            uuid: VEEPOO_WRITE.toUpperCase(),
            properties: { write: true, writeNoResponse: true },
          },
        ],
      }),
    )
    vi.mocked(transport.notifyBLECharacteristicValueChange).mockImplementation((request) => {
      notifyRequests.push(request)
      request.success?.({})
    })
    vi.mocked(transport.writeBLECharacteristicValue).mockImplementation((request) => {
      writes.push(request)
      request.success?.({})
    })
    vi.mocked(transport.getBLEMTU).mockImplementation(({ success }) => success?.({ mtu: 23 }))
    vi.mocked(transport.setBLEMTU).mockImplementation(({ success }) => success?.({ mtu: 23 }))
    globalThis.wx = transport
    sdk.init({ transport })
    const connection = vi.fn()
    sdk.veepooBle.veepooWeiXinSDKConnectionDevice(
      { deviceId: device.id, name: 'H7' },
      connection,
    )
    await vi.advanceTimersByTimeAsync(5_000)
    expect(notifyRequests).toEqual([
      expect.objectContaining({
        serviceId: VEEPOO_SERVICE.toUpperCase(),
        characteristicId: VEEPOO_NOTIFY.toUpperCase(),
      }),
    ])
    expect(connection).toHaveBeenCalledWith(expect.objectContaining({ connection: true }))
    expect(writes).not.toHaveLength(0)
    sdk.veepooBle.resetBleTransport()
    globalThis.wx = undefined
  })

  it('el SDK oficial decodifica el paquete de autenticación capturado del H7 físico', async () => {
    const { default: sdk } = await import('virtual:veepoo-sdk')
    const transport = fakeTransport()
    let rawListener: ((event: Record<string, unknown>) => void) | null = null
    vi.mocked(transport.onBLECharacteristicValueChange).mockImplementation((listener) => {
      rawListener = listener
    })
    vi.mocked(transport.notifyBLECharacteristicValueChange).mockImplementation(({ success }) =>
      success?.({}),
    )
    vi.mocked(transport.writeBLECharacteristicValue).mockImplementation(({ success }) =>
      success?.({}),
    )
    const event = vi.fn()
    globalThis.wx = transport
    sdk.veepooBle.veepooWeiXinSDKNotifyMonitorValueChange(event)
    sdk.init({
      transport,
      bleDate: {
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE.toUpperCase(),
        notifyCharacteristicId: VEEPOO_NOTIFY.toUpperCase(),
        writeCharacteristicId: VEEPOO_WRITE.toUpperCase(),
      },
    })
    expect(rawListener).not.toBeNull()
    const packet = new Uint8Array([
      0xa1, 0x00, 0x00, 0x06, 0x17, 0x27, 0x00, 0x72, 0x00, 0x08, 0x00, 0x01, 0x23,
      0x97, 0xf9, 0xa4, 0x73, 0xd2, 0x00, 0x00,
    ])
    const capturedListener = rawListener as ((event: Record<string, unknown>) => void) | null
    capturedListener?.({
      deviceId: device.id,
      serviceId: VEEPOO_SERVICE.toUpperCase(),
      characteristicId: VEEPOO_NOTIFY.toUpperCase(),
      value: packet.buffer,
    })
    expect(event).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 1,
        content: expect.objectContaining({
          VPDevicepassword: '0000',
          VPDeviceAck: 'successfulVerification',
          VPDeviceMAC: 'D2:73:A4:F9:97:23',
        }),
      }),
    )
    sdk.veepooBle.resetBleTransport()
    globalThis.wx = undefined
  })

  it('completa la sesión con el SDK real y la respuesta capturada del H7', async () => {
    const { default: sdk } = await import('virtual:veepoo-sdk')
    const transport = fakeTransport()
    let rawListener: ((event: Record<string, unknown>) => void) | null = null
    vi.mocked(transport.onBLECharacteristicValueChange).mockImplementation((listener) => {
      rawListener = listener
    })
    vi.mocked(transport.notifyBLECharacteristicValueChange).mockImplementation(({ success }) =>
      success?.({}),
    )
    vi.mocked(transport.writeBLECharacteristicValue).mockImplementation((request) => {
      request.success?.({})
      const command = new Uint8Array(request.value)
      if (command[0] !== 0xa1) return
      queueMicrotask(() => {
        const packet = new Uint8Array([
          0xa1, 0x00, 0x00, 0x06, 0x17, 0x27, 0x00, 0x72, 0x00, 0x08, 0x00, 0x01,
          0x23, 0x97, 0xf9, 0xa4, 0x73, 0xd2, 0x00, 0x00,
        ])
        rawListener?.({
          deviceId: device.id,
          serviceId: VEEPOO_SERVICE.toUpperCase(),
          characteristicId: VEEPOO_NOTIFY.toUpperCase(),
          value: packet.buffer,
        })
      })
    })
    const engine = makeEngine()
    const dispose = await subscribeVeepooSensors(
      device,
      engine,
      new AbortController().signal,
      {
        loadSdk: async () => sdk,
        createTransport: () => transport,
        authenticationTimeoutMs: 1_000,
      },
    )
    expect(engine.snapshot()).toMatchObject({
      protocol: 'veepoo',
      preparation: 'ready-to-measure',
    })
    expect(transport.createBLEConnection).not.toHaveBeenCalled()
    await dispose()
  })

  it('adapta servicios, características, notificaciones, escritura y almacenamiento web', async () => {
    const transport = new WebBluetoothVeepooTransport(device)
    const services = await callbackPromise<{ services: Array<{ uuid: string }> }>((success, fail) =>
      transport.getBLEDeviceServices({ deviceId: device.id, success, fail }),
    )
    expect(services.services[0].uuid).toBe(VEEPOO_SERVICE.toUpperCase())
    const characteristics = await callbackPromise<{
      characteristics: Array<{ uuid: string; properties: Record<string, boolean> }>
    }>((success, fail) =>
      transport.getBLEDeviceCharacteristics({
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE,
        success,
        fail,
      }),
    )
    expect(characteristics.characteristics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uuid: VEEPOO_NOTIFY.toUpperCase() }),
        expect.objectContaining({ uuid: VEEPOO_WRITE.toUpperCase() }),
      ]),
    )
    const received = vi.fn()
    transport.onBLECharacteristicValueChange(received)
    await callbackPromise((success, fail) =>
      transport.notifyBLECharacteristicValueChange({
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE,
        characteristicId: VEEPOO_NOTIFY,
        state: true,
        success,
        fail,
      }),
    )
    mock
      .getDevice('h7-test')!
      .gatt.getService(VEEPOO_SERVICE)!
      .getChar(VEEPOO_NOTIFY)!
      .emitNotification(new Uint8Array([0xd0, 0x01]))
    expect(new Uint8Array(received.mock.calls[0][0].value)).toEqual(new Uint8Array([0xd0, 0x01]))
    await callbackPromise((success, fail) =>
      transport.writeBLECharacteristicValue({
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE,
        characteristicId: VEEPOO_WRITE,
        value: new Uint8Array(45).buffer,
        writeNoResponse: true,
        success,
        fail,
      }),
    )
    transport.setStorageSync('password', '0000')
    expect(transport.getStorageSync('password')).toBe('0000')
    await transport.dispose()
    expect(
      mock.getDevice('h7-test')!.gatt.getService(VEEPOO_SERVICE)!.getChar(VEEPOO_NOTIFY)!
        .isNotifying,
    ).toBe(false)
  })

  it('resuelve por capacidad un firmware H7 con UUID de características alternativos', async () => {
    const alternateNotify = 'f0080012-0451-4000-b000-000000000000'
    const alternateWrite = 'f0080013-0451-4000-b000-000000000000'
    mock.uninstall()
    mock = installMockBluetooth({
      devices: [
        {
          id: 'h7-alternate',
          name: 'H7',
          services: [
            {
              uuid: VEEPOO_SERVICE,
              characteristics: [
                { uuid: alternateNotify, properties: { indicate: true } },
                { uuid: alternateWrite, properties: { writeWithoutResponse: true } },
              ],
            },
          ],
        },
      ],
    })
    device = await new Beacio().requestDevice({ acceptAllDevices: true })
    await device.connect()
    const transport = new WebBluetoothVeepooTransport(device)
    await callbackPromise((success, fail) =>
      transport.getBLEDeviceServices({ deviceId: device.id, success, fail }),
    )
    const received = vi.fn()
    transport.onBLECharacteristicValueChange(received)
    await callbackPromise((success, fail) =>
      transport.notifyBLECharacteristicValueChange({
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE,
        characteristicId: VEEPOO_NOTIFY,
        state: true,
        success,
        fail,
      }),
    )
    await callbackPromise((success, fail) =>
      transport.writeBLECharacteristicValue({
        deviceId: device.id,
        serviceId: VEEPOO_SERVICE,
        characteristicId: VEEPOO_WRITE,
        value: new Uint8Array([0xa1, 0x00]).buffer,
        writeNoResponse: true,
        success,
        fail,
      }),
    )
    const alternateDevice = mock.getDevice('h7-alternate')!
    const service = alternateDevice.gatt.getService(VEEPOO_SERVICE)!
    expect(service.getChar(alternateNotify)!.isNotifying).toBe(true)
    service.getChar(alternateNotify)!.emitNotification(new Uint8Array([0xd0, 0x01]))
    expect(received).toHaveBeenCalledOnce()
    await transport.dispose()
  })

  it('usa un identificador Veepoo válido para la plataforma del navegador', async () => {
    expect(['ios', 'android']).toContain(detectVeepooPlatform())
    expect(detectVeepooPlatform('MacIntel', 'Mozilla/5.0 Macintosh')).toBe('ios')
    expect(detectVeepooPlatform('iPhone', 'Mozilla/5.0 Mobile')).toBe('ios')
    expect(detectVeepooPlatform('Linux x86_64', 'Mozilla/5.0 Chrome')).toBe('android')
    expect(detectVeepooPlatform('Win32', 'Mozilla/5.0 Chrome')).toBe('android')
    const transport = new WebBluetoothVeepooTransport(device)
    expect(transport.getSystemInfoSync().platform).not.toBe('web')
    await transport.dispose()
  })

  it('autentica y controla una medición manual sin duplicar comandos', async () => {
    const engine = makeEngine()
    const transport = fakeTransport()
    const { sdk, emit, heartSwitches } = fakeSdk()
    const abort = new AbortController()
    let heartRateControl: { toggleMeasurement(): void } | null = null
    const dispose = await subscribeVeepooSensors(device, engine, abort.signal, {
      loadSdk: async () => sdk,
      createTransport: () => transport,
      authenticationTimeoutMs: 100,
      onHeartRateControl: (control) => {
        heartRateControl = control
      },
    })
    expect(engine.snapshot()).toMatchObject({
      protocol: 'veepoo',
      preparation: 'ready-to-measure',
    })
    expect(sdk.veepooFeature.veepooReadElectricQuantityManager).toHaveBeenCalledOnce()
    expect(sdk.init).toHaveBeenCalledWith({
      transport,
      bleDate: expect.objectContaining({
        notifyCharacteristicId: VEEPOO_NOTIFY.toUpperCase(),
        writeCharacteristicId: VEEPOO_WRITE.toUpperCase(),
      }),
    })
    expect(sdk.veepooBle.veepooWeiXinSDKConnectionDevice).not.toHaveBeenCalled()
    expect(heartSwitches).toEqual([])
    const control = heartRateControl as { toggleMeasurement(): void } | null
    control?.toggleMeasurement()
    expect(heartSwitches).toEqual([true])
    expect(engine.snapshot().preparation).toBe('starting-measurement')
    emit({ type: 2, content: { VPDeviceElectricPercent: 64 } })
    emit({ type: 51, content: { heartRate: 82, notWear: false, deviceBusy: false } })
    expect(engine.snapshot()).toMatchObject({
      battery: 64,
      heartRate: 82,
      preparation: 'receiving',
    })
    control?.toggleMeasurement()
    expect(heartSwitches).toEqual([true, false])
    expect(engine.snapshot().preparation).toBe('stopping-measurement')
    await dispose()
    await dispose()
    expect(heartSwitches).toEqual([true, false])
    expect(heartRateControl).toBeNull()
    expect(transport.dispose).toHaveBeenCalledOnce()
  })

  it('espera a que las notificaciones estén activas antes de escribir la clave', async () => {
    const transport = fakeTransport()
    let ready!: () => void
    vi.mocked(transport.waitUntilNotificationsReady).mockReturnValue(
      new Promise<void>((resolve) => {
        ready = resolve
      }),
    )
    const { sdk } = fakeSdk()
    const pending = subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: () => transport,
      authenticationTimeoutMs: 1_000,
    })
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce())
    expect(sdk.veepooFeature.veepooBlePasswordCheckManager).not.toHaveBeenCalled()
    ready()
    const dispose = await pending
    expect(sdk.veepooFeature.veepooBlePasswordCheckManager).toHaveBeenCalledOnce()
    await dispose()
  })

  it('continúa buscando BPM sin límite y permite detener manualmente durante la espera', async () => {
    vi.useFakeTimers()
    const engine = makeEngine()
    const transport = fakeTransport()
    const { sdk, heartSwitches } = fakeSdk()
    let control: { toggleMeasurement(): void } | null = null
    const dispose = await subscribeVeepooSensors(device, engine, new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: () => transport,
      authenticationTimeoutMs: 1_000,
      stopSettleMs: 10,
      measurementCooldownMs: 10,
      onHeartRateControl: (value) => {
        control = value
      },
    })
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    expect(engine.snapshot().preparation).toBe('starting-measurement')
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(engine.snapshot().preparation).toBe('starting-measurement')
    expect(heartSwitches).toEqual([true])
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    expect(heartSwitches).toEqual([true, false])
    expect(engine.snapshot().preparation).toBe('stopping-measurement')
    await vi.advanceTimersByTimeAsync(20)
    expect(engine.snapshot().preparation).toBe('ready-to-measure')
    await dispose()
    expect(heartSwitches).toEqual([true, false])
  })

  it('finaliza ocupado o sin contacto y permite reintentar después del cooldown', async () => {
    vi.useFakeTimers()
    const engine = makeEngine()
    const { sdk, emit, heartSwitches } = fakeSdk()
    let control: { toggleMeasurement(): void } | null = null
    const dispose = await subscribeVeepooSensors(device, engine, new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: fakeTransport,
      authenticationTimeoutMs: 1_000,
      measurementCooldownMs: 10,
      onHeartRateControl: (value) => {
        control = value
      },
    })
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    emit({ type: 51, content: { deviceBusy: true } })
    expect(engine.snapshot()).toMatchObject({
      preparation: 'measurement-cooldown',
      error: expect.stringContaining('procesando otra función'),
    })
    await vi.advanceTimersByTimeAsync(10)
    expect(engine.snapshot().preparation).toBe('ready-to-measure')
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    emit({ type: 51, content: { notWear: true } })
    expect(engine.snapshot()).toMatchObject({
      preparation: 'measurement-cooldown',
      contact: false,
      error: expect.stringContaining('contacto con la piel'),
    })
    await vi.advanceTimersByTimeAsync(10)
    expect(engine.snapshot().preparation).toBe('ready-to-measure')
    expect(heartSwitches).toEqual([true, true])
    await dispose()
  })

  it('mantiene una medición activa y recibe BPM después de varios minutos', async () => {
    vi.useFakeTimers()
    const engine = makeEngine()
    const { sdk, emit, heartSwitches } = fakeSdk()
    let control: { toggleMeasurement(): void } | null = null
    const dispose = await subscribeVeepooSensors(device, engine, new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: fakeTransport,
      authenticationTimeoutMs: 1_000,
      stopSettleMs: 10,
      measurementCooldownMs: 10,
      onHeartRateControl: (value) => {
        control = value
      },
    })
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    emit({ type: 51, content: { heartRate: 75 } })
    expect(engine.snapshot().preparation).toBe('receiving')
    await vi.advanceTimersByTimeAsync(30 * 60_000)
    expect(heartSwitches).toEqual([true])
    expect(engine.snapshot().preparation).toBe('receiving')
    emit({ type: 51, content: { heartRate: 78 } })
    expect(engine.snapshot().heartRate).toBe(78)
    await dispose()
    expect(heartSwitches).toEqual([true, false])
  })

  it('selecciona Veepoo cuando el H7 no expone Heart Rate estándar', async () => {
    const engine = makeEngine()
    const { sdk, emit, heartSwitches } = fakeSdk()
    setVeepooSdkLoaderForTests(async () => sdk)
    const abort = new AbortController()
    let control: { toggleMeasurement(): void } | null = null
    const cleanup = await subscribeDeviceSensors(device, null, engine, abort.signal, {
      onHeartRateControl: (value) => {
        control = value
      },
    })
    expect(engine.snapshot()).toMatchObject({
      protocol: 'veepoo',
      preparation: 'ready-to-measure',
      capabilities: { acceleration: 'unsupported', steps: 'unsupported' },
    })
    ;(control as { toggleMeasurement(): void } | null)?.toggleMeasurement()
    emit({ type: 51, content: { heartRate: 79 } })
    expect(engine.snapshot().heartRate).toBe(79)
    await cleanup()
    expect(heartSwitches).toEqual([true, false])
  })

  it('reintenta explícitamente la clave 0000 cuando falta la primera confirmación', async () => {
    vi.useFakeTimers()
    const transport = fakeTransport()
    const { sdk, emit } = fakeSdk(null)
    vi.mocked(sdk.veepooFeature.veepooBlePasswordCheckManager).mockImplementation(() => {
      emit({
        type: 1,
        content: { VPDevicepassword: '0000', VPDeviceAck: 'successfulVerification' },
      })
    })
    const pending = subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: () => transport,
      authenticationTimeoutMs: 10_000,
    })
    await vi.advanceTimersByTimeAsync(4_000)
    const dispose = await pending
    expect(sdk.veepooFeature.veepooBlePasswordCheckManager).toHaveBeenCalledWith({
      isPair: false,
    })
    await dispose()
  })

  it('informa rechazo de clave y limpia la sesión incompleta', async () => {
    const transport = fakeTransport()
    const { sdk } = fakeSdk('verifyNotPass')
    await expect(
      subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
        loadSdk: async () => sdk,
        createTransport: () => transport,
        authenticationTimeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' } satisfies Partial<VeepooSessionError>)
    expect(transport.dispose).toHaveBeenCalledOnce()
    expect(sdk.veepooBle.resetBleTransport).toHaveBeenCalledOnce()
  })

  it('falla inmediatamente si el H7 responde sin un ACK reconocido', async () => {
    const transport = fakeTransport()
    const { sdk } = fakeSdk('respuestaDesconocida')
    await expect(
      subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
        loadSdk: async () => sdk,
        createTransport: () => transport,
        authenticationTimeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_INVALID_RESPONSE',
      message: expect.stringContaining('formato reconocido'),
    } satisfies Partial<VeepooSessionError>)
    expect(transport.dispose).toHaveBeenCalledOnce()
  })

  it('desconecta GATT tras un fallo fatal para cancelar la reconexión automática', async () => {
    const { sdk } = fakeSdk('verifyNotPass')
    setVeepooSdkLoaderForTests(async () => sdk)
    await subscribeDeviceSensors(device, null, makeEngine(), new AbortController().signal)
    expect(device.raw.gatt?.connected).toBe(false)
  })

  it('no oculta un fallo del canal de notificaciones detrás del timeout de autenticación', async () => {
    const transport = fakeTransport()
    const { sdk, emit } = fakeSdk(null)
    const pending = subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
      loadSdk: async () => sdk,
      createTransport: () => transport,
      authenticationTimeoutMs: 1_000,
    })
    await vi.waitFor(() =>
      expect(sdk.veepooFeature.veepooBlePasswordCheckManager).toHaveBeenCalledOnce(),
    )
    emit({ errMsg: 'La característica de notificación Veepoo no está disponible.' })
    await expect(pending).rejects.toMatchObject({
      code: 'NOTIFICATION_UNAVAILABLE',
      message: expect.stringContaining('canal de notificaciones'),
    } satisfies Partial<VeepooSessionError>)
    expect(transport.dispose).toHaveBeenCalledOnce()
  })

  it('convierte un fallo de carga del SDK en un error accionable y libera el transporte', async () => {
    const transport = fakeTransport()
    await expect(
      subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
        loadSdk: async () => {
          throw new ReferenceError('module is not defined')
        },
        createTransport: () => transport,
      }),
    ).rejects.toMatchObject({
      code: 'SDK_LOAD_FAILED',
      message: expect.stringContaining('protocolo Veepoo'),
    } satisfies Partial<VeepooSessionError>)
    expect(transport.dispose).toHaveBeenCalledOnce()
    expect(globalThis.wx).toBeUndefined()
  })

  it('convierte un fallo de inicialización del SDK en un error accionable', async () => {
    const transport = fakeTransport()
    const { sdk } = fakeSdk()
    vi.mocked(sdk.init).mockImplementation(() => {
      throw new Error('fallo interno')
    })
    await expect(
      subscribeVeepooSensors(device, makeEngine(), new AbortController().signal, {
        loadSdk: async () => sdk,
        createTransport: () => transport,
      }),
    ).rejects.toMatchObject({ code: 'SDK_LOAD_FAILED' } satisfies Partial<VeepooSessionError>)
    expect(transport.dispose).toHaveBeenCalledOnce()
  })

  it('filtra paquetes inválidos, falta de uso y dispositivo ocupado sin crear 0 BPM', () => {
    const engine = makeEngine()
    engine.protocol('veepoo')
    expect(processVeepooHeartEvent(undefined, 'h7-test', engine)).toBe('invalid')
    expect(processVeepooHeartEvent({ heartRate: 0 }, 'h7-test', engine)).toBe('invalid')
    expect(processVeepooHeartEvent({ heartRate: 251 }, 'h7-test', engine)).toBe('invalid')
    expect(processVeepooHeartEvent({ notWear: true, heartRate: 0 }, 'h7-test', engine)).toBe(
      'not-worn',
    )
    expect(engine.snapshot()).toMatchObject({ heartRate: null, contact: false })
    expect(engine.snapshot().events).toHaveLength(0)
    expect(processVeepooHeartEvent({ deviceBusy: true }, 'h7-test', engine)).toBe('busy')
    expect(engine.snapshot().error).toContain('procesando')
    expect(processVeepooHeartEvent({ heartRate: 30 }, 'h7-test', engine)).toBe('valid')
    expect(engine.snapshot()).toMatchObject({ heartRate: 30, contact: true, error: null })
    expect(readVeepooBattery({ VPDeviceElectricPercent: 92 })).toBe(92)
    expect(readVeepooBattery({ VPDeviceElectricPercent: '92' })).toBeNull()
  })
})
