import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const login = async (page: Page) => {
  await page.goto('/#/login')
  await page.getByLabel('Usuario', { exact: true }).fill('admin')
  await page.getByLabel('Contraseña', { exact: true }).fill('admin')
  await page.getByRole('button', { name: 'Ingresar a mi espacio' }).click()
  await expect(page.getByText('Elena Martínez')).toBeVisible()
}
const menu = async (page: Page) => {
  const trigger = page.getByRole('button', { name: 'Abrir menú' })
  if (await trigger.isVisible()) await trigger.click()
}
const mockBle = async (page: Page) => {
  await page.evaluate(async () => {
    const path = '/tests/e2e/ble-fixture.ts'
    const fixture = (await import(/* @vite-ignore */ path)) as typeof import('./ble-fixture')
    fixture.installTestDevice()
  })
}
const mockVeepoo = async (page: Page) => {
  await page.evaluate(async () => {
    const path = '/tests/e2e/ble-fixture.ts'
    const fixture = (await import(/* @vite-ignore */ path)) as typeof import('./ble-fixture')
    fixture.installVeepooTestDevice()
  })
}
const loadRealVeepooSdk = async (page: Page) =>
  page.evaluate(async () => {
    const path = '/src/monitoring/services/veepooSession.ts'
    const session = (await import(/* @vite-ignore */ path)) as {
      loadVeepooSdk: () => Promise<{
        init?: unknown
        veepooBle?: { veepooWeiXinSDKConnectionDevice?: unknown }
        veepooFeature?: { veepooSendHeartRateTestSwitchManager?: unknown }
      }>
    }
    const sdk = await session.loadVeepooSdk()
    return [
      typeof sdk.init,
      typeof sdk.veepooBle?.veepooWeiXinSDKConnectionDevice,
      typeof sdk.veepooFeature?.veepooSendHeartRateTestSwitchManager,
    ]
  })
test('selección de historial por teclado y navegación móvil con foco contenido', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('button', { name: 'Pausar simulación' }).click()
  await page.getByRole('button', { name: '3 meses', exact: true }).click()
  await expect(page.getByRole('button', { name: '3 meses', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const slider = page.getByRole('slider').first()
  const initial = await slider.getAttribute('aria-valuenow')
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).not.toHaveAttribute('aria-valuenow', initial!)
  await page.getByRole('button', { name: 'Restablecer', exact: true }).click()
  await expect(slider).toHaveAttribute('aria-valuenow', initial!)
  await page.setViewportSize({ width: 390, height: 844 })
  const trigger = page.getByRole('button', { name: 'Abrir menú' })
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Navegación principal' })).not.toBeVisible()
})
test('login por teclado, validación, sesión de pestaña y logout', async ({ page }) => {
  await page.goto('/#/monitoreo')
  await expect(page).toHaveURL(/login/)
  await page.getByLabel('Usuario', { exact: true }).focus()
  await page.keyboard.type('admin')
  await page.keyboard.press('Tab')
  await page.keyboard.type('wrong')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('no son correctos')
  await page.getByLabel('Contraseña', { exact: true }).fill('admin')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/demo$/)
  await page.reload()
  await expect(page.getByText('Elena Martínez')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/login/)
  expect(await page.evaluate(() => sessionStorage.getItem('brazalete:session'))).toBeNull()
})
test('escenario cero, deduplicación, revisión y aislamiento demo/real', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Lectura cero', exact: true }).click()
  await expect(page.locator('.pulse-metric .metric-value')).toContainText('0')
  await page.getByRole('link', { name: /Alertas y eventos/ }).click()
  await expect(page.locator('.event-list .event-row')).toHaveCount(3)
  await page.locator('.event-list .event-row').first().click()
  await page.getByRole('button', { name: 'Marcar como revisada' }).click()
  await expect(page.getByRole('button', { name: 'Ya revisada' })).toBeDisabled()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await expect(page.getByText('Tu persona de cuidado')).toBeVisible()
  await expect(page.getByText('Esperando una lectura')).toBeVisible()
  await page.getByRole('link', { name: /Alertas y eventos/ }).click()
  await expect(page.getByText('Todo en orden por acá')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('brazalete:v1:telemetry'))).not.toContain(
    'demo-elena',
  )
})
test('Bluetooth simulado: recepción real, navegación, persistencia, desconexión y cambio de modo', async ({
  page,
}) => {
  await login(page)
  await mockBle(page)
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar pulsera', exact: true }).click()
  await expect(page.getByText('Recibiendo datos', { exact: true })).toBeVisible()
  const standardDevice = page.getByRole('region', { name: 'Persona y dispositivo' })
  await expect(
    standardDevice.getByRole('status', { name: '100% de batería, carga suficiente' }),
  ).toBeVisible()
  await expect(page.getByText('Batería: 100%', { exact: false })).toHaveCount(0)
  await page.evaluate(() => window.__bleTest.emitHeart(77))
  await expect(page.locator('.pulse-metric .metric-value')).toContainText('77')
  await page.getByRole('link', { name: /Alertas y eventos/ }).click()
  await page.evaluate(() => window.__bleTest.emitHeart(0, false))
  await expect(page.getByRole('button', { name: /Lectura de 0 BPM/ })).toBeVisible()
  await page.getByRole('link', { name: 'Vista general' }).click()
  await expect(page.getByText('Recibiendo datos', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Esperando una lectura')).toBeVisible()
  await expect(page.getByRole('button', { name: /Lectura de 0 BPM/ })).toBeVisible()
  await expect(page.locator('.range-values')).toContainText('77')
  // Reinstall the browser fixture before constructing the next SDK provider.
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await mockBle(page)
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar pulsera', exact: true }).click()
  await expect(page.getByText('Recibiendo datos', { exact: true })).toBeVisible()
  await page.evaluate(() => window.__bleTest.disconnect())
  await expect(page.getByRole('button', { name: /Conexión interrumpida/ })).toBeVisible()
  await expect(page.getByText('Recibiendo datos', { exact: true })).toBeVisible({
    timeout: 5000,
  })
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await expect(page.getByText('Elena Martínez')).toBeVisible()
  await page.evaluate(() => window.__bleTest.emitHeart(200))
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
  await expect(page.locator('.pulse-metric .metric-value')).not.toContainText('200')
})

test('H7 simulado: autentica y completa tres mediciones manuales sin duplicar comandos', async ({
  page,
}) => {
  await login(page)
  expect(await loadRealVeepooSdk(page)).toEqual(['function', 'function', 'function'])
  await mockVeepoo(page)
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar pulsera', exact: true }).click()
  await expect(page.getByText('Autenticando H7…', { exact: true })).toBeVisible()
  await page.evaluate(() => window.__bleTest.authenticate?.())
  await expect(page.getByText('Protocolo H7/Veepoo', { exact: false })).toBeVisible()
  const h7Device = page.getByRole('region', { name: 'Persona y dispositivo' })
  await expect(
    h7Device.getByRole('status', { name: '68% de batería, carga suficiente' }),
  ).toBeVisible()
  await expect(page.getByText('Batería: 68%', { exact: false })).toHaveCount(0)
  await expect(page.getByText('H7 listo para medir', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__bleTest.measurementRequests?.())).toBe(0)
  await expect(page.getByText('1 · Brazalete firme', { exact: true })).toBeVisible()

  for (const [index, bpm] of [84, 87, 90].entries()) {
    await page.getByRole('button', { name: 'Medir frecuencia', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__bleTest.measurementRequests?.())).toBe(
      index + 1,
    )
    await expect(page.getByText('Preparando el sensor…', { exact: true })).toBeVisible()
    await expect(page.getByText(/continuará hasta que la detengas/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Detener medición', exact: true })).toBeEnabled()
    await page.evaluate((value) => window.__bleTest.emitHeart(value), bpm)
    await expect(page.getByText('Midiendo en vivo', { exact: true })).toBeVisible()
    await expect(page.locator('.pulse-metric .metric-value')).toContainText(String(bpm))
    await page.getByRole('button', { name: 'Detener medición', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__bleTest.measurementStops?.())).toBe(
      index + 1,
    )
    await expect(page.getByRole('button', { name: 'Medir frecuencia', exact: true })).toBeEnabled({
      timeout: 3000,
    })
  }
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__bleTest.stopped?.())).toBe(true)
  await expect.poll(() => page.evaluate(() => window.__bleTest.measurementStops?.())).toBe(3)
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
})
test('ficha, importación de perfil, retención al reabrir y limpieza limitada', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Ana Pérez')
  await page.getByLabel('Edad', { exact: false }).fill('78')
  await page.getByRole('button', { name: 'Guardar ficha' }).click()
  await page
    .getByLabel('Importar perfil JSON', { exact: true })
    .setInputFiles('public/profiles/perfil-ejemplo.json')
  await page.getByRole('button', { name: 'Validar y aplicar perfil' }).click()
  await expect(page.getByText('Perfil guardado. Volvé a conectar la pulsera.')).toBeVisible()
  await page.getByRole('button', { name: 'En vivo', exact: true }).click()
  await expect(page.getByText('Ana Pérez', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const timestamp = Date.now() - 25 * 3600_000
    localStorage.setItem('preservar', 'ok')
    localStorage.setItem(
      'brazalete:v1:telemetry',
      JSON.stringify({
        version: 1,
        devices: [
          {
            deviceId: 'old',
            deviceName: 'Viejo',
            summaries: [],
            events: [
              {
                id: 'old',
                deviceId: 'old',
                source: 'real',
                timestamp,
                type: 'possible-fall',
                reviewed: false,
                evidence: 'Vencido',
              },
            ],
          },
        ],
      }),
    )
  })
  await page.reload()
  await page.getByRole('link', { name: /Alertas y eventos/ }).click()
  await expect(page.getByText('Todo en orden por acá')).toBeVisible()
  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  await page.getByRole('button', { name: 'Limpiar historial real' }).click()
  await page.getByRole('button', { name: 'Sí, limpiar historial' }).click()
  expect(await page.evaluate(() => localStorage.getItem('preservar'))).toBe('ok')
  expect(await page.evaluate(() => localStorage.getItem('brazalete:v1:settings'))).toContain(
    'Ana Pérez',
  )
})
test('demo de caída genera evidencia sólo tras diez segundos de inmovilidad', async ({ page }) => {
  await page.clock.install()
  await login(page)
  await page.getByRole('button', { name: 'Posible caída', exact: true }).click()
  await page.clock.runFor(13000)
  await expect(page.getByRole('button', { name: /Posible caída Evento simulado/ })).toBeVisible()
})
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`revisión visual y accesibilidad ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/#/login')
    await expect(page.getByLabel('Usuario', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true })
    const loginAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(loginAudit.violations).toEqual([])
    await login(page)
    await page.getByRole('button', { name: 'Pausar simulación' }).click()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true })
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(audit.violations).toEqual([])
    await menu(page)
    await page.getByRole('link', { name: /Alertas y eventos/ }).click()
    await expect(page.getByRole('heading', { name: 'Alertas y eventos.' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('alertas.png'), fullPage: true })
    await menu(page)
    await page.getByRole('link', { name: 'Configuración', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath('configuracion.png'), fullPage: true })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
}
