import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
export function useMobileNavigation() {
  const [menu, setMenu] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    setMenu(false)
  }, [pathname])
  useEffect(() => {
    if (!menu) return
    const node = sidebarRef.current
    const elements = () =>
      [...(node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? [])].filter(
        (el) => el.getClientRects().length,
      )
    elements()[0]?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false)
        return
      }
      if (event.key !== 'Tab') return
      const list = elements(),
        first = list[0],
        last = list.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onResize = () => {
      if (window.innerWidth > 700) setMenu(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const trigger = triggerRef.current
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = overflow
      trigger?.focus()
    }
  }, [menu])
  return { menu, setMenu, sidebarRef, triggerRef }
}
