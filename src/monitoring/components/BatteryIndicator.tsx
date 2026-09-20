interface BatteryIndicatorProps {
  value: number | null
}

const batteryPresentation = (value: number | null) => {
  if (value === null)
    return {
      percentage: null,
      tone: 'unknown',
      label: 'Batería sin datos',
      accessibleLabel: 'Batería sin datos',
    } as const

  const percentage = Math.min(100, Math.max(0, value))
  if (percentage <= 10)
    return {
      percentage,
      tone: 'critical',
      label: 'Batería crítica',
      accessibleLabel: `${percentage}% de batería, nivel crítico`,
    } as const
  if (percentage <= 20)
    return {
      percentage,
      tone: 'low',
      label: 'Batería baja',
      accessibleLabel: `${percentage}% de batería, nivel bajo`,
    } as const
  if (percentage <= 40)
    return {
      percentage,
      tone: 'medium',
      label: 'Carga media',
      accessibleLabel: `${percentage}% de batería, carga media`,
    } as const
  return {
    percentage,
    tone: 'healthy',
    label: 'Carga suficiente',
    accessibleLabel: `${percentage}% de batería, carga suficiente`,
  } as const
}

export function BatteryIndicator({ value }: BatteryIndicatorProps) {
  const presentation = batteryPresentation(value)
  const width = presentation.percentage ?? 0

  return (
    <div
      className={`device-battery ${presentation.tone}`}
      role="status"
      aria-label={presentation.accessibleLabel}
    >
      <span className="battery-visual" aria-hidden="true">
        <span className="battery-level" style={{ width: `${width}%` }} />
      </span>
      <span className="battery-copy">
        <strong>{presentation.percentage === null ? '—' : `${presentation.percentage}%`}</strong>
        <span>{presentation.label}</span>
      </span>
    </div>
  )
}
