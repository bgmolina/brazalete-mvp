import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['tests/e2e/**'],
      env: { VITE_ADMIN_USERNAME: 'admin', VITE_ADMIN_PASSWORD: 'admin' },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: [
          'src/shared/services/**',
          'src/shared/utils/detection.ts',
          'src/monitoring/services/**',
          'src/auth/hooks/**',
          'src/monitoring/hooks/**',
          'src/settings/hooks/**',
        ],
      },
    },
  }),
)
