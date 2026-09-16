import { Activity, BatteryMedium, Footprints, HeartPulse } from 'lucide-react'
import type { DeviceCapabilities } from '@shared/types/monitoring'
const sensors = [
  { key: 'heartRate', label: 'Pulso', Icon: HeartPulse },
  { key: 'acceleration', label: 'Acelerómetro', Icon: Activity },
  { key: 'steps', label: 'Pasos', Icon: Footprints },
  { key: 'battery', label: 'Batería', Icon: BatteryMedium },
] as const
const statusLabels = {
  available: 'Disponible',
  unsupported: 'No compatible',
  waiting: 'Sin datos',
  error: 'Error de lectura',
}
export function Capabilities({ value }: { value: DeviceCapabilities }) {
  return (
    <div className="capability-list">
      {sensors.map(({ key, label, Icon }) => (
        <div key={key} className="capability">
          <span>
            <Icon size={15} />
            {label}
          </span>
          <span className={`capability-status ${value[key]}`}>
            <span className="status-dot" />
            {statusLabels[value[key]]}
          </span>
        </div>
      ))}
    </div>
  )
}
