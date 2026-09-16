import { MockCharacteristic } from '@beacio/core/testing'

/**
 * Beacio 2.1.1's official mock emits a synthetic `{ value }` event.target,
 * but its core routes notifications by characteristic identity. Restore the
 * browser's EventTarget contract in tests; production code is not modified.
 */
export function normalizeMockEventTargets() {
  const original = MockCharacteristic.prototype.asBluetoothRemoteGATTCharacteristic
  MockCharacteristic.prototype.asBluetoothRemoteGATTCharacteristic = function (service) {
    const proxy = original.call(this, service)
    const add = proxy.addEventListener.bind(proxy)
    const remove = proxy.removeEventListener.bind(proxy)
    const listeners = new Map<EventListenerOrEventListenerObject, EventListener>()
    proxy.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
      const wrapped: EventListener = (event) => {
        const normalized = new Event(event.type)
        Object.defineProperty(normalized, 'target', { value: proxy })
        if (typeof listener === 'function') listener(normalized)
        else listener.handleEvent(normalized)
      }
      listeners.set(listener, wrapped)
      add(type, wrapped)
    }
    proxy.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
      const wrapped = listeners.get(listener)
      if (wrapped) {
        remove(type, wrapped)
        listeners.delete(listener)
      }
    }
    return proxy
  }
  return () => {
    MockCharacteristic.prototype.asBluetoothRemoteGATTCharacteristic = original
  }
}
