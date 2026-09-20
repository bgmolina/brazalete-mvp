import { BLE_UUIDS, devices, installMockBluetooth } from '@beacio/core/testing'
import type { VeepooEvent, VeepooSdk } from '@/vendor/veepoo/index.cjs'
import { setVeepooSdkLoaderForTests } from '@monitoring/services/veepooSession'
import {
  VEEPOO_NOTIFY,
  VEEPOO_SERVICE,
  VEEPOO_WRITE,
  type VeepooTransport,
} from '@monitoring/services/veepooTransport'
import { normalizeMockEventTargets } from '../helpers/mockNotifications'
declare global {
  interface Window {
    __bleTest: {
      emitHeart: (bpm: number, contact?: boolean) => void
      disconnect: () => void
      authenticate?: (result?: string) => void
      stopped?: () => boolean
      measurementRequests?: () => number
      measurementStops?: () => number
    }
  }
}
// Loaded explicitly by Playwright through Vite. Never imported by the app build.
export function installTestDevice() {
  setVeepooSdkLoaderForTests(null)
  normalizeMockEventTargets()
  const mock = installMockBluetooth({
    devices: [{ ...devices.full('Pulsera virtual de prueba'), id: 'e2e-watch' }],
  })
  window.__bleTest = {
    emitHeart: (bpm, contact = true) => {
      mock
        .getDevice('e2e-watch')!
        .gatt.getService(BLE_UUIDS.services.HEART_RATE)!
        .getChar(BLE_UUIDS.characteristics.HEART_RATE_MEASUREMENT)!
        .emitNotification(new Uint8Array([contact ? 6 : 4, bpm]))
    },
    disconnect: () => mock.getDevice('e2e-watch')!.simulateDisconnect(),
  }
}

export function installVeepooTestDevice() {
  normalizeMockEventTargets()
  const mock = installMockBluetooth({
    devices: [
      {
        id: 'e2e-h7',
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
      },
    ],
  })
  let notify: ((event: VeepooEvent) => void) | null = null
  let stopped = false
  let measurementRequests = 0
  let measurementStops = 0
  const sdk: VeepooSdk = {
    init: ({ transport, bleDate }) => {
      const bridge = transport as VeepooTransport
      if (!bleDate) return
      bridge.onBLECharacteristicValueChange(() => undefined)
      bridge.notifyBLECharacteristicValueChange({
        ...bleDate,
        characteristicId: bleDate.notifyCharacteristicId,
        state: true,
      })
    },
    veepooBle: {
      veepooWeiXinSDKConnectionDevice: (_device, callback) => callback({ connection: true }),
      veepooWeiXinSDKNotifyMonitorValueChange: (callback) => {
        notify = callback
      },
      resetBleTransport: () => undefined,
    },
    veepooFeature: {
      veepooBlePasswordCheckManager: () => undefined,
      veepooReadElectricQuantityManager: () =>
        notify?.({ type: 2, content: { VPDeviceElectricPercent: 68 } }),
      veepooSendHeartRateTestSwitchManager: ({ switch: enabled }) => {
        if (enabled) measurementRequests++
        else {
          stopped = true
          measurementStops++
        }
      },
    },
  }
  setVeepooSdkLoaderForTests(async () => sdk)
  window.__bleTest = {
    authenticate: (result = 'successfulVerification') =>
      notify?.({
        type: 1,
        content: {
          VPDevicepassword: '0000',
          VPDeviceAck: result,
          VPDeviceMAC: 'D2:73:A4:F9:97:23',
        },
      }),
    emitHeart: (bpm) =>
      notify?.({ type: 51, content: { heartRate: bpm, deviceBusy: false, notWear: false } }),
    disconnect: () => mock.getDevice('e2e-h7')!.simulateDisconnect(),
    stopped: () => stopped,
    measurementRequests: () => measurementRequests,
    measurementStops: () => measurementStops,
  }
}
