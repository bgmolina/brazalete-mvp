import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ADMIN_CREDENTIALS,
  getAdminCredentials,
} from '@auth/config/adminCredentials'
import { publicUrl } from '@shared/utils/publicUrl'

describe('configuración de despliegue', () => {
  it('usa admin/admin cuando las variables no existen o están vacías', () => {
    vi.stubEnv('VITE_ADMIN_USERNAME', '')
    vi.stubEnv('VITE_ADMIN_PASSWORD', '  ')
    expect(getAdminCredentials()).toEqual(DEFAULT_ADMIN_CREDENTIALS)
  })

  it('permite sobrescribir las credenciales con variables Vite', () => {
    vi.stubEnv('VITE_ADMIN_USERNAME', 'cuidador')
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'demo-publica')
    expect(getAdminCredentials()).toEqual({
      username: 'cuidador',
      password: 'demo-publica',
    })
  })

  it('construye recursos públicos dentro de la base configurada', () => {
    expect(publicUrl('/profiles/perfil-ejemplo.json', '/brazalete-mvp/')).toBe(
      '/brazalete-mvp/profiles/perfil-ejemplo.json',
    )
    expect(publicUrl('favicon.svg', '/')).toBe('/favicon.svg')
  })
})
