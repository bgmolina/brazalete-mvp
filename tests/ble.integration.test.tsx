import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { BeacioProvider } from '@beacio/react'
import { Beacio } from '@beacio/core'
import { BLE_UUIDS, devices, installMockBluetooth, type MockBluetooth } from '@beacio/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBluetoothMonitor } from '@monitoring/hooks/useBluetoothMonitor'
import { subscribeDeviceSensors } from '@monitoring/services/bleSensors'
import { realEngine } from '@shared/store/monitoringStore'
import { useSettingsStore } from '@shared/store/settingsStore'
import { normalizeMockEventTargets } from './helpers/mockNotifications'
import { bleProfileSchema } from '@shared/services/bleProfiles'
import template from '../public/profiles/perfil-ejemplo.json'
let mock: MockBluetooth
let restoreTargets: () => void
beforeEach(() => {
  restoreTargets = normalizeMockEventTargets()
  mock = installMockBluetooth({
    devices: [{ ...devices.full('Pulsera de prueba'), id: 'ble-test' }],
  })
  realEngine.clearHistory()
  realEngine.connection('disconnected')
  useSettingsStore.setState({ profile: null })
})
afterEach(() => {
  mock.uninstall()
  restoreTargets()
})
const characteristic = () =>
  mock
    .getDevice('ble-test')!
    .gatt.getService(BLE_UUIDS.services.HEART_RATE)!
    .getChar(BLE_UUIDS.characteristics.HEART_RATE_MEASUREMENT)!
describe('Integración BLE con mocks oficiales de Beacio', () => {
  it('un dispositivo parcial sigue conectado aunque no tenga pulso estándar', async () => {
    mock.removeDevice('ble-test')
    mock.addDevice({ ...devices.battery('Sólo batería'), id: 'partial' })
    const device = await new Beacio().requestDevice({ acceptAllDevices: true })
    await device.connect()
    realEngine.attach(device.id, device.name!)
    const abort = new AbortController()
    const cleanup = await subscribeDeviceSensors(device, null, realEngine, abort.signal)
    expect(realEngine.snapshot().connection).toBe('connected')
    expect(realEngine.snapshot().capabilities).toMatchObject({
      heartRate: 'unsupported',
      battery: 'available',
      acceleration: 'unsupported',
    })
    expect(realEngine.snapshot().heartRate).toBeNull()
    cleanup()
    device.disconnect()
  })
  it('recibe sensores configurables y recupera un error de formato con una lectura válida', async () => {
    const profile = bleProfileSchema.parse(template)
    mock.removeDevice('ble-test')
    const raw = mock.addDevice({
      id: 'configured',
      services: [
        {
          uuid: profile.acceleration!.service,
          characteristics: [
            { uuid: profile.acceleration!.characteristic, properties: { notify: true } },
            { uuid: profile.steps!.characteristic, properties: { notify: true } },
          ],
        },
      ],
    })
    const device = await new Beacio().requestDevice({ acceptAllDevices: true })
    await device.connect()
    realEngine.attach(device.id, 'Configurado')
    const abort = new AbortController()
    const cleanup = await subscribeDeviceSensors(device, profile, realEngine, abort.signal)
    const service = raw.gatt.getService(profile.acceleration!.service)!
    const acceleration = service.getChar(profile.acceleration!.characteristic)!
    const steps = service.getChar(profile.steps!.characteristic)!
    acceleration.emitNotification(new Uint8Array([1]))
    expect(realEngine.snapshot().capabilities.acceleration).toBe('error')
    acceleration.emitNotification(new Uint8Array([100, 0, 156, 255, 232, 3]))
    steps.emitNotification(new Uint8Array([100, 0, 0, 0]))
    steps.emitNotification(new Uint8Array([105, 0, 0, 0]))
    expect(realEngine.snapshot().acceleration.at(-1)).toMatchObject({ x: 0.1, y: -0.1, z: 1 })
    expect(realEngine.snapshot().steps).toBe(5)
    expect(realEngine.snapshot().capabilities.acceleration).toBe('available')
    abort.abort()
    cleanup()
    device.disconnect()
  })
  it('selecciona, conecta y recibe exactamente una muestra bajo StrictMode; se reconecta y limpia', async () => {
    const { result, unmount } = renderHook(() => useBluetoothMonitor(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <BeacioProvider>{children}</BeacioProvider>
        </StrictMode>
      ),
    })
    await act(async () => {
      void result.current.connect()
    })
    await waitFor(() => expect(characteristic().isNotifying).toBe(true))
    act(() => {
      characteristic().emitNotification(new Uint8Array([6, 73]))
      realEngine.tick()
    })
    await waitFor(() => expect(realEngine.snapshot().heartRate).toBe(73))
    expect(realEngine.snapshot().summaries[0].hrCount).toBe(1)
    act(() => mock.getDevice('ble-test')!.simulateDisconnect())
    await waitFor(() => expect(realEngine.snapshot().connection).toBe('disconnected'))
    await waitFor(() => expect(characteristic().isNotifying).toBe(true), { timeout: 3000 })
    act(() => {
      characteristic().emitNotification(new Uint8Array([6, 75]))
      realEngine.tick()
    })
    await waitFor(() => expect(realEngine.snapshot().summaries[0].hrCount).toBe(2))
    act(() => result.current.disconnect())
    await waitFor(() => expect(characteristic().isNotifying).toBe(false))
    act(() => characteristic().emitNotification(new Uint8Array([6, 0])))
    expect(realEngine.snapshot().events.filter((e) => e.type === 'zero-heart-rate')).toHaveLength(0)
    unmount()
    expect(mock.getDevice('ble-test')!.gatt.connected).toBe(false)
  })
  it('cancelación y permiso denegado dejan una interfaz utilizable', async () => {
    const request = vi
      .spyOn(mock, 'requestDevice')
      .mockRejectedValueOnce(new DOMException('User cancelled', 'NotFoundError'))
    const { result } = renderHook(() => useBluetoothMonitor(), {
      wrapper: ({ children }) => <BeacioProvider>{children}</BeacioProvider>,
    })
    await act(async () => {
      await result.current.connect()
    })
    expect(realEngine.snapshot().connection).toBe('disconnected')
    request.mockRejectedValueOnce(new DOMException('Permission denied', 'SecurityError'))
    await act(async () => {
      await result.current.connect()
    })
    await waitFor(() => expect(realEngine.snapshot().error).not.toBeNull())
  })
  it('abort durante la preparación elimina suscripciones tardías', async () => {
    const sdk = new Beacio()
    const device = await sdk.requestDevice({ acceptAllDevices: true })
    await device.connect()
    realEngine.attach(device.id, device.name || 'Reloj')
    const abort = new AbortController()
    const pending = subscribeDeviceSensors(device, null, realEngine, abort.signal)
    abort.abort()
    const cleanup = await pending
    expect(characteristic().isNotifying).toBe(false)
    cleanup()
    device.disconnect()
  })
  it('tres reintentos con espera progresiva; al agotar informa error', async () => {
    const { result } = renderHook(() => useBluetoothMonitor(), {
      wrapper: ({ children }) => <BeacioProvider>{children}</BeacioProvider>,
    })
    await act(async () => {
      void result.current.connect()
    })
    await waitFor(() => expect(characteristic().isNotifying).toBe(true))
    const attempts = vi
      .spyOn(mock.getDevice('ble-test')!.gatt, 'connect')
      .mockRejectedValue(new DOMException('unavailable', 'NetworkError'))
    vi.useFakeTimers()
    act(() => mock.getDevice('ble-test')!.simulateDisconnect())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(attempts).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(attempts).toHaveBeenCalledTimes(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(attempts).toHaveBeenCalledTimes(3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(attempts).toHaveBeenCalledTimes(3)
    expect(realEngine.snapshot().error).not.toBeNull()
  })
})
