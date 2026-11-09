import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { SearchResponse } from '../src/api/generated/models/SearchResponse'
import { mkdir } from 'node:fs/promises'

// Synthetic API responses exercise UI states, not catalogue semantics.
const mixed: SearchResponse = { matches: [
  { referenceId: 'mock-forbidden', verdict: 'FORBIDDEN', description: 'Описание запрещённого случая', userPathCode: '<BB>', referencePathCode: '<BB>', source: { document: 'Тестовый документ', page: 49, example: 'Схема 1', conclusion: 'Основание запрета' } },
  { referenceId: 'mock-undetermined', verdict: 'UNDETERMINED', description: null, userPathCode: '<BMB>', referencePathCode: '<BMB>', source: { document: null, page: null, example: null, conclusion: null } },
  { referenceId: 'mock-allowed', verdict: 'ALLOWED', description: 'Описание разрешённого случая', userPathCode: 'M<BB>B>', referencePathCode: 'M<BB>B>', source: { document: 'Другой документ', page: 65, example: null, conclusion: null } },
] }
const endpoint = '**/api/v1/references/search'
async function openSearch(page: Page) { await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click() }
async function addParent(page: Page) {
  await page.getByRole('button', { name: 'Добавить родственника', exact: true }).click()
  await page.getByRole('button', { name: 'Родителя', exact: true }).click()
}

for (const width of [1440, 390]) {
  test(`renders every verdict, source, path and contradiction at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.route(endpoint, route => route.fulfill({ json: mixed }))
    await page.goto('/'); await openSearch(page)
    const results = page.getByRole('region', { name: 'Результаты поиска' })
    await expect(results.getByText('Найдено совпадений:', { exact: false })).toBeVisible()
    await expect(results.locator('.match-card')).toHaveCount(3)
    for (const match of mixed.matches) await expect(results.getByText(match.referenceId, { exact: true })).toBeVisible()
    await expect(results.locator('.forbidden .verdict-badge')).toHaveCSS('color', 'rgb(150, 61, 54)')
    await expect(results.locator('.undetermined .verdict-badge')).toHaveCSS('color', 'rgb(120, 90, 22)')
    await expect(results.locator('.allowed .verdict-badge')).toHaveCSS('color', 'rgb(47, 102, 64)')
    await expect(results.locator('.conflict-note')).toContainText('и разрешённые, и запрещённые')
    await expect(results).toContainText('Тестовый документ · стр. 49')
    await expect(results).toContainText('Схема 1')
    await expect(results).toContainText('Основание запрета')
    await expect(results.locator('.undetermined code').first()).toHaveText('<BMB>')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await mkdir('artifacts', { recursive: true })
    await page.screenshot({ path: `artifacts/search-mixed-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Закрыть поиск', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Добавить родственника', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Связать с существующим', exact: true })).toBeVisible()
  })
}

test('submits selected A/B and the graph using the API contract', async ({ page }) => {
  let body: unknown
  await page.route(endpoint, async route => { body = route.request().postDataJSON(); await route.fulfill({ json: { matches: [] } }) })
  await page.goto('/'); await addParent(page)
  await page.getByRole('button', { name: 'Участники и результаты', exact: true }).click()
  const option = page.getByLabel('Участник A', { exact: true }).locator('option').last()
  const parentId = await option.getAttribute('value')
  await page.getByLabel('Участник A', { exact: true }).selectOption(parentId!)
  await page.getByLabel('Участник B', { exact: true }).selectOption('person-a')
  await page.getByRole('button', { name: 'Повторить поиск', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Совпадений в справочнике не найдено. Это не означает разрешения.')
  expect(body).toEqual({ persons: [{ id: 'person-a', name: 'Персона A' }, { id: 'person-b', name: 'Персона B' }, { id: parentId, name: 'Родитель' }], relations: [{ type: 'BIOLOGICAL', from: parentId, to: 'person-a' }], personA: parentId, personB: 'person-a' })
})

test('loading blocks double submission and a new search replaces previous results', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let calls = 0
  await page.route(endpoint, async route => { calls++; if (calls === 1) await pending; await route.fulfill({ json: calls === 1 ? mixed : { matches: [] } }) })
  await page.goto('/'); await openSearch(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Ищем совпадения…', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Ищем совпадения…', exact: true }).evaluate((el: HTMLButtonElement) => el.click())
  expect(calls).toBe(1)
  release()
  await expect(dialog.locator('.match-card')).toHaveCount(3)
  await dialog.getByRole('button', { name: 'Повторить поиск', exact: true }).click()
  await expect(dialog.locator('.match-card')).toHaveCount(0)
  await expect(dialog).toContainText('Это не означает разрешения')
  expect(calls).toBe(2)
})

for (const error of ['network', 'validation', 'server']) {
  test(`shows a readable ${error} error`, async ({ page }) => {
    await page.route(endpoint, route => error === 'network' ? route.abort('failed') : route.fulfill({ status: error === 'validation' ? 400 : 500, json: { message: 'stack trace should never be displayed' } }))
    await page.goto('/'); await openSearch(page)
    const alert = page.getByRole('region', { name: 'Результаты поиска' }).getByRole('alert')
    await expect(alert).toContainText(error === 'network' ? 'Не удалось связаться' : error === 'validation' ? 'Сервер отклонил граф' : 'временно недоступен')
    await expect(alert).not.toContainText('stack trace')
  })
}

test('invalid pair does not send a request', async ({ page }) => {
  let calls = 0
  await page.route(endpoint, route => { calls++; return route.fulfill({ json: mixed }) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Участники и результаты', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Постройте граф')
  await page.getByLabel('Участник B', { exact: true }).selectOption('person-a')
  await page.getByRole('button', { name: 'Повторить поиск', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Выберите двух разных людей для A и B.')
  expect(calls).toBe(0)
})

test('graph and participant changes clear previous matches', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: mixed }))
  await page.goto('/'); await openSearch(page)
  await expect(page.locator('.match-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Закрыть поиск', exact: true }).click()
  await addParent(page)
  await page.getByRole('button', { name: 'Участники и результаты', exact: true }).click()
  await expect(page.locator('.match-card')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Выполните поиск заново')
  await page.getByRole('button', { name: 'Повторить поиск', exact: true }).click()
  await expect(page.locator('.match-card')).toHaveCount(3)
  await page.getByLabel('Участник A', { exact: true }).selectOption({ label: 'Родитель' })
  await expect(page.locator('.match-card')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Выполните поиск заново')
})
