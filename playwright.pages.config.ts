import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/pages.spec.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/pages' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-pages',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npm run build:pages && npm run preview:pages -- --port 4173',
    url: 'http://127.0.0.1:4173/brazalete-mvp/',
    reuseExistingServer: false,
  },
})
