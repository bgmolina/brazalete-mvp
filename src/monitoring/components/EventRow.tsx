import { Activity, BluetoothOff, CircleAlert, ChevronRight, CircleCheck } from 'lucide-react'
import type { MonitoringEvent } from '@shared/types/monitoring'
import { eventTitle, relativeTime, time } from '@shared/utils/format'
const icons = {
  'zero-heart-rate': Activity,
  'possible-fall': CircleAlert,
  disconnected: BluetoothOff,
}
export function EventRow({ event, onClick }: { event: MonitoringEvent; onClick?: () => void }) {
  const Icon = icons[event.type]
  return (
    <button className="event-row" onClick={onClick}>
      <span className={`event-icon event-${event.type}`}>
        <Icon size={18} />
      </span>
      <span className="event-copy">
        <strong>{eventTitle[event.type]}</strong>
        <span>
          {event.source === 'demo' ? 'Evento simulado' : 'Registro local; envío no implementado'} ·{' '}
          {time(event.timestamp)}
        </span>
      </span>
      <span className="event-end">
        {event.reviewed ? (
          <span className="reviewed-label">
            <CircleCheck size={13} /> Revisada
          </span>
        ) : (
          <span>{relativeTime(event.timestamp)}</span>
        )}
        <ChevronRight size={16} />
      </span>
    </button>
  )
}
