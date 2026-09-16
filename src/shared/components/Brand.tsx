import { HeartPulse } from 'lucide-react'
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <HeartPulse size={23} strokeWidth={1.8} />
      </span>
      <span>
        Reserviamo<span className="brand-dot">.</span>
      </span>
    </span>
  )
}
