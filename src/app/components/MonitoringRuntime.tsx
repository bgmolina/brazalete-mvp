import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BeacioProvider } from '@beacio/react'
import {
  MonitoringActionsContext,
  type MonitoringActions,
  type Scenario,
} from '@shared/hooks/useMonitoringActions'
import { demoEngine, realEngine } from '@shared/store/monitoringStore'
import { DemoSimulation } from '@monitoring/services/demo'
import { useBluetoothMonitor } from '@monitoring/hooks/useBluetoothMonitor'
import type { Mode } from '@shared/types/monitoring'

const demo = new DemoSimulation(demoEngine)
let seeded = false
function DemoRuntime({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<Scenario>(demo.scenario)
  useEffect(() => {
    if (!seeded) {
      demo.reset()
      seeded = true
    }
    const timer = window.setInterval(() => demo.step(), 50)
    return () => window.clearInterval(timer)
  }, [])
  const value = useMemo<MonitoringActions>(
    () => ({
      mode: 'demo',
      supported: true,
      scenario,
      connect: async () => {},
      disconnect: () => {},
      measureHeartRate: () => {},
      simulate: (s) => {
        demo.setScenario(s)
        setScenario(s)
      },
      togglePause: () => demo.pause(),
      resetDemo: () => {
        demo.reset()
        setScenario('rest')
      },
    }),
    [scenario],
  )
  return (
    <MonitoringActionsContext.Provider value={value}>{children}</MonitoringActionsContext.Provider>
  )
}
function RealRuntime({ children }: { children: ReactNode }) {
  const bluetooth = useBluetoothMonitor()
  const value = useMemo<MonitoringActions>(
    () => ({
      mode: 'real',
      supported: bluetooth.isSupported,
      connect: bluetooth.connect,
      disconnect: bluetooth.disconnect,
      measureHeartRate: bluetooth.measureHeartRate,
      scenario: 'rest',
      simulate: () => {},
      togglePause: () => {},
      resetDemo: () => {},
    }),
    [bluetooth.connect, bluetooth.disconnect, bluetooth.isSupported, bluetooth.measureHeartRate],
  )
  return (
    <MonitoringActionsContext.Provider value={value}>{children}</MonitoringActionsContext.Provider>
  )
}
export function MonitoringRuntime({ mode, children }: { mode: Mode; children: ReactNode }) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      realEngine.tick()
      if (mode === 'demo') demoEngine.tick()
    }, 1000)
    const flush = () => realEngine.flush()
    window.addEventListener('pagehide', flush)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', flush)
      realEngine.flush()
    }
  }, [mode])
  return mode === 'demo' ? (
    <DemoRuntime>{children}</DemoRuntime>
  ) : (
    <BeacioProvider>
      <RealRuntime>{children}</RealRuntime>
    </BeacioProvider>
  )
}
