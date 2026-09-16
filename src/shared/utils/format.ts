export const time = (value: number, seconds = false) =>
  new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hour12: false,
  }).format(value)
export const date = (value: number) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(value)
export const number = (value: number) => new Intl.NumberFormat('es-AR').format(value)
export function relativeTime(value: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - value) / 1000))
  return seconds < 5
    ? 'Ahora'
    : seconds < 60
      ? `Hace ${seconds} s`
      : seconds < 3600
        ? `Hace ${Math.floor(seconds / 60)} min`
        : `Hace ${Math.floor(seconds / 3600)} h`
}
export const eventTitle = {
  'zero-heart-rate': 'Lectura de 0 BPM: revisar medición',
  'possible-fall': 'Posible caída',
  disconnected: 'Conexión interrumpida',
} as const
