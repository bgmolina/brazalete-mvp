import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@auth/store/authStore'
import { getAdminCredentials } from '@auth/config/adminCredentials'
const schema = z.object({
  username: z.string().min(1, 'Ingresá tu usuario'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})
export function useLogin() {
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })
  const credentials = getAdminCredentials()
  const submit = form.handleSubmit((values) => {
    if (
      values.username === credentials.username &&
      values.password === credentials.password
    ) {
      login()
      navigate('/demo', { replace: true })
    } else setError('El usuario o la contraseña no son correctos.')
  })
  return { form, visible, toggleVisible: () => setVisible((v) => !v), error, submit }
}
