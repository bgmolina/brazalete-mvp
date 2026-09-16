import { create } from 'zustand'
const KEY = 'brazalete:session'
function readSession() {
  try {
    return sessionStorage.getItem(KEY) === 'active'
  } catch {
    return false
  }
}
export const useAuthStore = create<{
  authenticated: boolean
  login: () => void
  logout: () => void
}>((set) => ({
  authenticated: readSession(),
  login: () => {
    try {
      sessionStorage.setItem(KEY, 'active')
    } catch {
      /* Session remains in memory. */
    }
    set({ authenticated: true })
  },
  logout: () => {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* Memory session still closes. */
    }
    set({ authenticated: false })
  },
}))
