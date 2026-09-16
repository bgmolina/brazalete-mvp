export const DEFAULT_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin',
} as const

const configuredValue = (value: string | undefined, fallback: string) => value?.trim() || fallback

export function getAdminCredentials() {
  return {
    username: configuredValue(
      import.meta.env.VITE_ADMIN_USERNAME,
      DEFAULT_ADMIN_CREDENTIALS.username,
    ),
    password: configuredValue(
      import.meta.env.VITE_ADMIN_PASSWORD,
      DEFAULT_ADMIN_CREDENTIALS.password,
    ),
  }
}
