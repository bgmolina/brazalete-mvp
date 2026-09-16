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
