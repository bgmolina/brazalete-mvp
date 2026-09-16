import { useMemo, useState } from 'react'
import { useMonitoringActions } from '@shared/hooks/useMonitoringActions'
import { useMonitoringStore } from '@shared/store/monitoringStore'
import { useSettingsStore } from '@shared/store/settingsStore'
import type { MinuteSummary } from '@shared/types/monitoring'

export interface HistoryPoint {
  timestamp: number
  average: number | null
  range: [number, number] | null
  zero: number | null
}
export function historySeries(
  summaries: MinuteSummary[],
  hours: number,
  now: number,
): HistoryPoint[] {
  const duration = hours * 3600_000
  const interval = Math.max(60_000, Math.ceil(duration / 180 / 60_000) * 60_000)
  const from = Math.floor((now - duration) / interval) * interval
  const buckets = new Map<
    number,
    { sum: number; count: number; min: number; max: number; zeros: number }
  >()
  summaries
    .filter((s) => s.timestamp >= now - duration && s.timestamp <= now)
    .forEach((s) => {
      const timestamp = Math.floor(s.timestamp / interval) * interval
      const b = buckets.get(timestamp) ?? {
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        zeros: 0,
      }
      b.sum += s.hrSum
      b.count += s.hrCount
      b.zeros += s.zeros
      if (s.hrMin !== null) b.min = Math.min(b.min, s.hrMin)
      if (s.hrMax !== null) b.max = Math.max(b.max, s.hrMax)
      buckets.set(timestamp, b)
    })
  const points: HistoryPoint[] = []
  for (let timestamp = from; timestamp <= now; timestamp += interval) {
    const b = buckets.get(timestamp)
    points.push({
      timestamp,
      average: b?.count ? Math.round(b.sum / b.count) : null,
      range: b?.count ? [b.min, b.max] : null,
      zero: b?.zeros ? 0 : null,
    })
  }
  return points
}
export function useDashboard() {
  const actions = useMonitoringActions()
  const snapshot = useMonitoringStore((s) => s[actions.mode])
  const name = useSettingsStore((s) => s.name)
  const age = useSettingsStore((s) => s.age)
  const [period, setPeriod] = useState(24)
  const [viewKey, setViewKey] = useState(0)
  const periods =
    actions.mode === 'demo'
      ? [
          { hours: 24, label: '24 horas' },
          { hours: 168, label: '7 días' },
          { hours: 720, label: '1 mes' },
          { hours: 2160, label: '3 meses' },
        ]
      : [
          { hours: 1, label: '1 hora' },
          { hours: 6, label: '6 horas' },
          { hours: 24, label: '24 horas' },
        ]
  const safePeriod = periods.some((p) => p.hours === period) ? period : 24
  const history = useMemo(
    () => historySeries(snapshot.summaries, safePeriod, snapshot.now),
    [snapshot.summaries, safePeriod, snapshot.now],
  )
  const valid = snapshot.summaries.filter(
    (s) => s.timestamp >= snapshot.now - safePeriod * 3600_000 && s.hrCount > 0,
  )
  const min = valid.length ? Math.min(...valid.map((s) => s.hrMin!)) : null
  const max = valid.length ? Math.max(...valid.map((s) => s.hrMax!)) : null
  const stale =
    snapshot.lastHeartAt !== null &&
    (snapshot.now - snapshot.lastHeartAt >= 10000 || snapshot.connection !== 'connected')
  const selectedPerson =
    actions.mode === 'demo'
      ? { name: 'Elena Martínez', age: 74 }
      : { name: name || 'Tu persona de cuidado', age }
  return {
    actions,
    snapshot,
    person: selectedPerson,
    period: safePeriod,
    periods,
    history,
    min,
    max,
    stale,
    viewKey,
    setPeriod: (hours: number) => {
      setPeriod(hours)
      setViewKey((k) => k + 1)
    },
    resetView: () => setViewKey((k) => k + 1),
  }
}
