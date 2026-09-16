import { create } from 'zustand'
import { MonitoringEngine } from '@shared/services/MonitoringEngine'
import { TelemetryStorage, getLocalStorage } from '@shared/services/telemetryStorage'
import type { Mode, MonitoringSnapshot } from '@shared/types/monitoring'

export const realEngine = new MonitoringEngine(
  'real',
  (snapshot) => useMonitoringStore.setState({ real: snapshot }),
  new TelemetryStorage(getLocalStorage()),
)
export const demoEngine = new MonitoringEngine('demo', (snapshot) =>
  useMonitoringStore.setState({ demo: snapshot }),
)
export const useMonitoringStore = create<{ real: MonitoringSnapshot; demo: MonitoringSnapshot }>(
  () => ({ real: realEngine.snapshot(), demo: demoEngine.snapshot() }),
)
export const getEngine = (mode: Mode) => (mode === 'demo' ? demoEngine : realEngine)
