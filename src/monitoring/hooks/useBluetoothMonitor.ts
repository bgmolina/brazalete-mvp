import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useBluetooth, useConnection } from '@beacio/react'
import { useSettingsStore } from '@shared/store/settingsStore'
import { realEngine } from '@shared/store/monitoringStore'
import { subscribeDeviceSensors, describeBluetoothError } from '@monitoring/services/bleSensors'
import { VEEPOO_SERVICE } from '@monitoring/services/veepooTransport'

const RECONNECT = { maxAttempts: 3, initialDelay: 1000, backoffMultiplier: 2 }
export function useBluetoothMonitor() {
  const profile = useSettingsStore((s) => s.profile)
  const { isSupported, error: bluetoothError } = useBluetooth()
  const optionalServices = useMemo(
    () => [
      ...new Set(
        [
          'heart_rate',
          'battery_service',
          'device_information',
          VEEPOO_SERVICE,
          profile?.acceleration?.service,
          profile?.steps?.service,
        ].filter((s): s is string => !!s),
      ),
    ],
    [profile],
  )
  const { device, status, isConnected, connect, disconnect, error } = useConnection({
    acceptAllDevices: true,
    optionalServices,
    autoReconnect: RECONNECT,
  })
  const intentional = useRef(false)
  const lastDevice = useRef(device)
  const activeCleanup = useRef<(() => Promise<void>) | null>(null)
  const heartRateControl = useRef<null | { toggleMeasurement(): void }>(null)
  useEffect(() => {
    lastDevice.current = device
  }, [device])
  useEffect(() => {
    if (isConnected && device) {
      const calibrated =
        !!profile?.acceleration?.calibrated && !!profile.acceleration.includesGravity
      realEngine.attach(device.id, device.name || 'Pulsera Bluetooth', calibrated)
      const abort = new AbortController()
      let cleaned = false
      const subscription = subscribeDeviceSensors(device, profile, realEngine, abort.signal, {
        onHeartRateControl: (control) => {
          heartRateControl.current = control
        },
      })
      const cleanup = async () => {
        if (cleaned) return
        cleaned = true
        abort.abort()
        heartRateControl.current = null
        const dispose = await subscription.catch(() => null)
        if (dispose) await dispose()
        realEngine.flush()
      }
      activeCleanup.current = cleanup
      return () => {
        if (activeCleanup.current === cleanup) activeCleanup.current = null
        void cleanup()
      }
    }
  }, [isConnected, device, profile])
  useEffect(() => {
    if (isConnected) return
    if (status === 'requesting' || status === 'connecting') realEngine.connection(status)
    else if (status === 'disconnected' || status === 'idle')
      realEngine.connection('disconnected', null, !intentional.current)
  }, [isConnected, status])
  useEffect(() => {
    if (error || bluetoothError)
      realEngine.setError(describeBluetoothError(error ?? bluetoothError))
  }, [error, bluetoothError])
  useEffect(
    () => () => {
      const cleanup = activeCleanup.current?.() ?? Promise.resolve()
      void cleanup.finally(() => {
        lastDevice.current?.disconnect()
        realEngine.connection('disconnected')
        realEngine.flush()
      })
    },
    [],
  )
  const handleConnect = useCallback(async () => {
    intentional.current = false
    realEngine.setError(null)
    await connect()
  }, [connect])
  const handleDisconnect = useCallback(() => {
    intentional.current = true
    void (activeCleanup.current?.() ?? Promise.resolve()).then(() => {
      disconnect()
      realEngine.connection('disconnected')
      realEngine.flush()
    })
  }, [disconnect])
  const toggleHeartRateMeasurement = useCallback(() => {
    heartRateControl.current?.toggleMeasurement()
  }, [])
  return {
    isSupported: isSupported && window.isSecureContext,
    connect: handleConnect,
    disconnect: handleDisconnect,
    toggleHeartRateMeasurement,
  }
}
