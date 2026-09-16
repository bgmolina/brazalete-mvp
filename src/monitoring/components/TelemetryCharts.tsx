import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AccelPoint, HeartPoint } from '@shared/types/monitoring'
import type { HistoryPoint } from '@monitoring/hooks/useDashboard'
import { date, time } from '@shared/utils/format'

const config = {
  bpm: { label: 'Frecuencia cardíaca', color: '#397d6a' },
  average: { label: 'Promedio', color: '#397d6a' },
  range: { label: 'Mínimo / máximo', color: '#bbd8cb' },
  zero: { label: 'Lectura 0 BPM', color: '#bc594b' },
  rejected: { label: 'Sin contacto', color: '#ad7529' },
  magnitude: { label: 'Magnitud (g)', color: '#668a75' },
} satisfies ChartConfig
const axis = { tickLine: false, axisLine: false, tickMargin: 10, minTickGap: 45, fontSize: 11 }
export function LiveChart({ points }: { points: HeartPoint[] }) {
  const data = points.map((p) => ({
    timestamp: p.timestamp,
    bpm: p.quality === 'no-contact' ? null : p.bpm,
    zero: p.bpm === 0 ? 0 : null,
    rejected: p.quality === 'no-contact' ? p.bpm : null,
  }))
  return (
    <ChartContainer
      config={config}
      className="telemetry-chart"
      role="region"
      aria-label="Gráfico de frecuencia cardíaca de los últimos diez minutos"
    >
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ top: 12, right: 14, left: -16, bottom: 0 }}
      >
        <defs>
          <linearGradient id="pulse-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8bb69d" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8bb69d" stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="timestamp" tickFormatter={(t) => time(t as number)} {...axis} />
        <YAxis domain={[0, 'auto']} {...axis} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => time(payload[0]?.payload.timestamp as number, true)}
            />
          }
        />
        <Area
          type="linear"
          dataKey="bpm"
          fill="url(#pulse-fill)"
          stroke="var(--color-bpm)"
          strokeWidth={2.2}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="zero"
          stroke="none"
          dot={{ r: 4, fill: 'var(--color-zero)', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="rejected"
          stroke="none"
          dot={{ r: 3, fill: 'var(--color-rejected)' }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
export function HistoryChart({ points, hours }: { points: HistoryPoint[]; hours: number }) {
  const label = (t: number) => (hours > 24 ? date(t) : time(t))
  return (
    <ChartContainer
      config={config}
      className="history-chart"
      role="region"
      aria-label="Historial de frecuencia cardíaca con selección de intervalo"
    >
      <ComposedChart
        accessibilityLayer
        data={points}
        margin={{ top: 15, right: 12, left: -16, bottom: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="timestamp" tickFormatter={label} {...axis} />
        <YAxis domain={[0, 'auto']} {...axis} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                `${date(payload[0]?.payload.timestamp as number)} · ${time(payload[0]?.payload.timestamp as number)}`
              }
            />
          }
        />
        <Area
          type="linear"
          dataKey="range"
          stroke="none"
          fill="var(--color-range)"
          fillOpacity={0.5}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="average"
          stroke="var(--color-average)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="zero"
          stroke="none"
          dot={{ r: 4, fill: 'var(--color-zero)' }}
          isAnimationActive={false}
        />
        <Brush
          dataKey="timestamp"
          height={24}
          travellerWidth={10}
          tickFormatter={label}
          stroke="#b5cfc0"
          fill="#f5f8f4"
          ariaLabel="Seleccionar intervalo del historial"
        />
      </ComposedChart>
    </ChartContainer>
  )
}
export function MotionChart({ points }: { points: AccelPoint[] }) {
  return (
    <ChartContainer
      config={config}
      className="motion-chart"
      role="region"
      aria-label="Magnitud de aceleración en unidades g"
    >
      <ComposedChart
        accessibilityLayer
        data={points.filter((_, i) => i % 4 === 0)}
        margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="timestamp" tickFormatter={(t) => time(t as number, true)} {...axis} />
        <YAxis domain={[0, 'auto']} {...axis} />
        <ReferenceLine y={1} stroke="#c5cabe" strokeDasharray="4 4" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => time(payload[0]?.payload.timestamp as number, true)}
            />
          }
        />
        <Area
          type="linear"
          dataKey="magnitude"
          stroke="var(--color-magnitude)"
          fill="#e8f0e8"
          fillOpacity={0.7}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
