import { createContext, useContext } from 'react'
import type { Mode } from '@shared/types/monitoring'
export type Scenario = 'rest' | 'moving' | 'zero' | 'fall' | 'disconnected'
export interface MonitoringActions {
  mode: Mode
  supported: boolean
  connect: () => Promise<void>
  disconnect: () => void
  scenario: Scenario
  simulate: (scenario: Scenario) => void
  togglePause: () => void
  resetDemo: () => void
}
export const MonitoringActionsContext = createContext<MonitoringActions | null>(null)
export function useMonitoringActions() {
  const value = useContext(MonitoringActionsContext)
  if (!value) throw new Error('Monitoring actions provider missing')
  return value
}
