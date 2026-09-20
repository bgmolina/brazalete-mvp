export type Mode = 'demo' | 'real'
export type DeviceProtocol = 'standard-heart-rate' | 'veepoo'
export type PreparationPhase =
  | 'idle'
  | 'discovering'
  | 'authenticating'
  | 'starting-measurement'
  | 'stopping-measurement'
  | 'measurement-cooldown'
  | 'ready-to-measure'
  | 'receiving'
export type SensorKind = 'heartRate' | 'acceleration' | 'steps' | 'battery'
export type CapabilityStatus = 'available' | 'unsupported' | 'waiting' | 'error'
export type DeviceCapabilities = Record<SensorKind, CapabilityStatus>
export type ConnectionStatus =
  | 'disconnected'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
export type Quality = 'valid' | 'no-contact' | 'unknown'
export interface Acceleration {
  x: number
  y: number
  z: number
}
interface ReadingBase {
  deviceId: string
  source: Mode
  timestamp: number
}
export type SensorReading = ReadingBase &
  (
    | { kind: 'heartRate'; value: number; contact: boolean | null }
    | { kind: 'acceleration'; value: Acceleration }
    | { kind: 'steps' | 'battery'; value: number }
  )
export interface HeartPoint {
  timestamp: number
  bpm: number | null
  quality: Quality
}
export interface AccelPoint extends Acceleration {
  timestamp: number
  magnitude: number
}
export interface MinuteSummary {
  timestamp: number
  hrSum: number
  hrCount: number
  hrMin: number | null
  hrMax: number | null
  zeros: number
  movementSum: number
  movementCount: number
  steps: number
}
export type EventType = 'zero-heart-rate' | 'possible-fall' | 'disconnected'
export interface MonitoringEvent {
  id: string
  deviceId: string
  source: Mode
  timestamp: number
  type: EventType
  reviewed: boolean
  evidence: string
}
export interface DeviceHistory {
  deviceId: string
  deviceName: string
  summaries: MinuteSummary[]
  events: MonitoringEvent[]
}
export interface MonitoringSnapshot {
  deviceId: string | null
  deviceName: string
  connection: ConnectionStatus
  protocol: DeviceProtocol | null
  preparation: PreparationPhase
  capabilities: DeviceCapabilities
  heartRate: number | null
  contact: boolean | null
  lastHeartAt: number | null
  battery: number | null
  steps: number
  motion: 'rest' | 'moving' | 'unknown'
  fallReady: boolean
  fallPending: boolean
  heartPoints: HeartPoint[]
  acceleration: AccelPoint[]
  summaries: MinuteSummary[]
  events: MonitoringEvent[]
  error: string | null
  storageWarning: string | null
  paused: boolean
  now: number
}
export const EMPTY_CAPABILITIES: DeviceCapabilities = {
  heartRate: 'waiting',
  acceleration: 'unsupported',
  steps: 'unsupported',
  battery: 'unsupported',
}
