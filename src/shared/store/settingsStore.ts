import { create } from 'zustand'
import { z } from 'zod'
import { bleProfileSchema, type BleProfileConfig } from '@shared/services/bleProfiles'
import { getLocalStorage } from '@shared/services/telemetryStorage'

export const SETTINGS_KEY = 'brazalete:v1:settings'
const schema = z.object({
  name: z.string().max(80),
  age: z.number().int().min(1).max(120).nullable(),
  profile: bleProfileSchema.nullable(),
})
interface Settings {
  name: string
  age: number | null
  profile: BleProfileConfig | null
  warning: string | null
  save: (values: { name: string; age: number | null; profile: BleProfileConfig | null }) => boolean
}
function read() {
  try {
    return schema.parse(JSON.parse(getLocalStorage()?.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return { name: '', age: null, profile: null }
  }
}
export const useSettingsStore = create<Settings>((set, get) => ({
  ...read(),
  warning: null,
  save: (values) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) return false
    // Editing the person must not recreate sensor subscriptions.
    const profile =
      JSON.stringify(parsed.data.profile) === JSON.stringify(get().profile)
        ? get().profile
        : parsed.data.profile
    try {
      const storage = getLocalStorage()
      if (!storage) throw new Error('unavailable')
      storage.setItem(SETTINGS_KEY, JSON.stringify(parsed.data))
      set({ ...parsed.data, profile, warning: null })
      return true
    } catch {
      set({
        ...parsed.data,
        profile,
        warning: 'Los cambios sólo se conservarán durante esta sesión.',
      })
      return false
    }
  },
}))
