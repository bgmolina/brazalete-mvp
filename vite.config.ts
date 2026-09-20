import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const veepooSdkPath = fileURLToPath(
  new URL('./src/vendor/veepoo/index.cjs', import.meta.url),
)
const veepooVirtualId = 'virtual:veepoo-sdk'
const veepooResolvedId = `\0${veepooVirtualId}`

/**
 * The obfuscated upstream bundle assigns through `module[decoded("exports")]`.
 * Rollup recognizes it during production builds, but Vite's dev server otherwise
 * serves the local CJS file unchanged. Keep the compatibility scope on this one
 * byte-for-byte vendored artifact instead of adding Node globals to the browser.
 */
const veepooCommonJsBridge = (): Plugin => ({
  name: 'veepoo-commonjs-bridge',
  enforce: 'pre',
  resolveId(id) {
    return id === veepooVirtualId ? veepooResolvedId : null
  },
  load(id) {
    if (id !== veepooResolvedId) return null
    const code = readFileSync(veepooSdkPath, 'utf8')
    return [
      'const __veepooCommonJsModule = { exports: {} };',
      'const module = __veepooCommonJsModule;',
      code,
      'export default __veepooCommonJsModule.exports;',
    ].join('\n')
  },
})

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/brazalete-mvp/' : '/',
  plugins: [veepooCommonJsBridge(), react(), tailwindcss()],
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
