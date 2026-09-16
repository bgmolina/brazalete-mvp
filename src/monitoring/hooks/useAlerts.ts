import { useState } from 'react'
import { useMonitoringActions } from '@shared/hooks/useMonitoringActions'
import { getEngine, useMonitoringStore } from '@shared/store/monitoringStore'
import type { EventType } from '@shared/types/monitoring'
export function useAlerts() {
  const { mode } = useMonitoringActions()
  const events = useMonitoringStore((s) => s[mode].events)
  const [filter, setFilter] = useState<EventType | 'all'>('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return {
    mode,
    filter,
    setFilter,
    pendingOnly,
    setPendingOnly,
    selected: events.find((e) => e.id === selectedId) ?? null,
    setSelectedId,
    events: events.filter(
      (e) => (filter === 'all' || e.type === filter) && (!pendingOnly || !e.reviewed),
    ),
    total: events.length,
    pending: events.filter((e) => !e.reviewed).length,
    review: (id: string) => getEngine(mode).review(id),
  }
}
