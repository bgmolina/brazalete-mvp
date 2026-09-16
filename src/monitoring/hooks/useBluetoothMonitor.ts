import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useBluetooth, useConnection } from '@beacio/react'
import { useSettingsStore } from '@shared/store/settingsStore'
import { realEngine } from '@shared/store/monitoringStore'
import { subscribeDeviceSensors, describeBluetoothError } from '@monitoring/services/bleSensors'

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
  useEffect(() => {
    lastDevice.current = device
  }, [device])
  useEffect(() => {
    if (isConnected && device) {
      const calibrated =
        !!profile?.acceleration?.calibrated && !!profile.acceleration.includesGravity
      realEngine.attach(device.id, device.name || 'Pulsera Bluetooth', calibrated)
      const abort = new AbortController()
      let dispose: (() => void) | undefined
      void subscribeDeviceSensors(device, profile, realEngine, abort.signal).then((fn) => {
        if (abort.signal.aborted) fn()
        else dispose = fn
      })
      return () => {
        abort.abort()
        dispose?.()
        realEngine.flush()
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
      lastDevice.current?.disconnect()
      realEngine.connection('disconnected')
      realEngine.flush()
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
    disconnect()
    realEngine.connection('disconnected')
    realEngine.flush()
  }, [disconnect])
  return {
    isSupported: isSupported && window.isSecureContext,
    connect: handleConnect,
    disconnect: handleDisconnect,
  }
}
