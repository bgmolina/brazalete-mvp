import { expect, test } from '@playwright/test'

test('el build de Pages carga recursos, autentica y conserva la ruta al recargar', async ({
  page,
  request,
}) => {
  const failedResponses: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/brazalete-mvp/#/login')
  await expect(page).toHaveTitle(/Brazalete/)
  await expect(page.getByLabel('Usuario', { exact: true })).toBeVisible()

  const favicon = await page.locator('link[rel="icon"]').getAttribute('href')
  expect(favicon).toBe('/brazalete-mvp/favicon.svg')
  expect((await request.get(favicon!)).status()).toBe(200)

  await page.getByLabel('Usuario', { exact: true }).fill('admin')
  await page.getByLabel('Contraseña', { exact: true }).fill('admin')
  await page.getByRole('button', { name: 'Ingresar a mi espacio' }).click()
  await expect(page).toHaveURL(/\/brazalete-mvp\/#\/demo$/)
  await expect(page.getByText('Elena Martínez')).toBeVisible()

  const veepooSdkLoaded = await page.evaluate(async () => {
    const base = new URL('/brazalete-mvp/', window.location.origin)
    const queue = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.endsWith('.js'))
    const visited = new Set<string>()
    while (queue.length) {
      const url = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)
      const source = await fetch(url).then((response) => response.text())
      if (source.length > 150_000 && source.includes('successfulVerification')) {
        await import(/* @vite-ignore */ url)
        return true
      }
      for (const match of source.matchAll(/["']((?:\.\/|assets\/)[^"']+\.js)["']/g)) {
        const dependency = new URL(match[1], match[1].startsWith('assets/') ? base : url).href
        if (!visited.has(dependency)) queue.push(dependency)
      }
    }
    return false
  })
  expect(veepooSdkLoaded).toBe(true)

  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  const templateLink = page.getByRole('link', { name: 'Descargar plantilla' })
  await expect(templateLink).toHaveAttribute(
    'href',
    '/brazalete-mvp/profiles/perfil-ejemplo.json',
  )
  const templateUrl = await templateLink.getAttribute('href')
  expect((await request.get(templateUrl!)).status()).toBe(200)

  await page.reload()
  await expect(page).toHaveURL(/\/brazalete-mvp\/#\/configuracion$/)
  await expect(page.getByRole('heading', { name: 'Configuración.' })).toBeVisible()
  expect(failedResponses).toEqual([])
})
