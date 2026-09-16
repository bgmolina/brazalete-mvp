import { BLE_UUIDS, devices, installMockBluetooth } from '@beacio/core/testing'
import { normalizeMockEventTargets } from '../helpers/mockNotifications'
declare global {
  interface Window {
    __bleTest: { emitHeart: (bpm: number, contact?: boolean) => void; disconnect: () => void }
  }
}
// Loaded explicitly by Playwright through Vite. Never imported by the app build.
export function installTestDevice() {
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
