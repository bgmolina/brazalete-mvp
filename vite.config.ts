import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/brazalete-mvp/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: Object.fromEntries(
      [
        ['@', './src'],
        ['@app', './src/app'],
        ['@auth', './src/auth'],
        ['@monitoring', './src/monitoring'],
        ['@settings', './src/settings'],
        ['@shared', './src/shared'],
      ].map(([key, path]) => [key, fileURLToPath(new URL(path, import.meta.url))]),
    ),
  },
  optimizeDeps: { include: ['@beacio/core/testing'] },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/coverage/**'] },
  },
}))
