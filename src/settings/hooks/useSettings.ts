import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useSettingsStore } from '@shared/store/settingsStore'
import { realEngine, useMonitoringStore } from '@shared/store/monitoringStore'
import { bleProfileSchema, type BleProfileConfig } from '@shared/services/bleProfiles'
import { useMonitoringActions } from '@shared/hooks/useMonitoringActions'
interface PersonForm {
  name: string
  age: string
}
export function useSettings() {
  const settings = useSettingsStore()
  const real = useMonitoringStore((s) => s.real)
  const actions = useMonitoringActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profileText, setProfileText] = useState(
    settings.profile ? JSON.stringify(settings.profile, null, 2) : '',
  )
  const [profileError, setProfileError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const form = useForm<PersonForm>({
    defaultValues: { name: settings.name, age: settings.age?.toString() ?? '' },
  })
  const savePerson = form.handleSubmit((values) => {
    const name = values.name.trim()
    const age = values.age.trim() ? Number(values.age) : null
    if (name.length > 80) {
      form.setError('name', { message: 'Usá hasta 80 caracteres.' })
      return
    }
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) {
      form.setError('age', { message: 'Ingresá una edad entre 1 y 120 años.' })
      return
    }
    const persisted = settings.save({ name, age, profile: settings.profile })
    if (persisted) toast.success('Ficha de cuidado guardada')
    else toast.warning('Ficha actualizada sólo en memoria')
    form.reset({ name, age: age?.toString() ?? '' })
  })
  const applyProfile = (profile: BleProfileConfig | null) => {
    if (actions.mode === 'real') actions.disconnect()
    const persisted = settings.save({ name: settings.name, age: settings.age, profile })
    setProfileError(null)
    setProfileText(profile ? JSON.stringify(profile, null, 2) : '')
    if (persisted)
      toast.success(
        profile ? 'Perfil guardado. Volvé a conectar la pulsera.' : 'Perfil adicional eliminado',
      )
    else toast.warning('Perfil actualizado sólo en memoria')
  }
  const saveProfile = () => {
    try {
      const parsed = bleProfileSchema.safeParse(JSON.parse(profileText))
      if (!parsed.success) {
        setProfileError(
          parsed.error.issues
            .map((i) => `${i.path.join('.') || 'Perfil'}: ${i.message}`)
            .join(' · '),
        )
        return
      }
      applyProfile(parsed.data)
    } catch {
      setProfileError('El archivo no contiene JSON válido. Revisá la sintaxis o usá la plantilla.')
    }
  }
  const importProfile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 32_768) {
      setProfileError('El perfil no puede superar los 32 KB.')
      return
    }
    try {
      setProfileText(await file.text())
      setProfileError(null)
    } catch {
      setProfileError('No se pudo leer el archivo.')
    }
  }
  const clear = () => {
    const success = realEngine.clearHistory()
    setConfirmClear(false)
    if (success) toast.success('Historial real eliminado de este navegador')
    else toast.error('No fue posible limpiar el almacenamiento')
  }
  return {
    fileInputRef,
    settings,
    real,
    form,
    savePerson,
    profileText,
    setProfileText,
    profileError,
    saveProfile,
    importProfile,
    removeProfile: () => applyProfile(null),
    confirmClear,
    setConfirmClear,
    clear,
  }
}
