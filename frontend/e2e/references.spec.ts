import { catalogFixture } from '../tests/catalogFixture'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const original = catalogFixture()
const cases = Array.from({ length: 23 }, (_, i) => {
  const record = original[i % original.length]
  return { metadata: { ...record, sources: undefined, source: { ...record.source, image: undefined }, id: `case-${i + 1}`, tags: i % 2 ? ['проверка'] : [], hasImage: false },
    graph: { persons: record.persons, relations: record.relations, personA: record.personA, personB: record.personB } }
})
async function mock(page: Page) {
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: cases.map(c => c.metadata) }))
  await page.route('**/api/v1/references/*', route => route.fulfill({ json: cases.find(c => c.metadata.id === route.request().url().split('/').pop()) }))
}
test('ten expanded graphs, A B, missing image, fullscreen and infinite scroll', async ({ page }) => {
  await mock(page); await page.goto('/references')
  await expect(page.locator('.reference-card')).toHaveCount(10)
  const first = page.locator('.reference-card').first()
  await expect(first.locator('.role-a')).toHaveCount(1); await expect(first.locator('.role-b')).toHaveCount(1)
  await expect(first).toContainText('Изображение из PDF пока не добавлено.')
  await first.getByRole('button', { name: 'Развернуть граф' }).click()
  await expect(page.locator('dialog[open] .vue-flow__node')).toHaveCount(cases[0]!.graph.persons.length)
  await page.getByRole('button', { name: 'Закрыть граф' }).click()
  await page.locator('.feed-sentinel').scrollIntoViewIfNeeded(); await expect(page.locator('.reference-card')).toHaveCount(20)
  await page.locator('.feed-sentinel').scrollIntoViewIfNeeded(); await expect(page.locator('.reference-card')).toHaveCount(23)
  await expect(page.getByText('Конец списка.', { exact: true })).toBeVisible()
})
test('global category verdict tag search filters reset the feed', async ({ page }) => {
  await mock(page); await page.goto('/references'); await expect(page.locator('.reference-card')).toHaveCount(10)
  await page.getByLabel('Свойство', { exact: true }).check(); await expect(page.locator('.reference-card')).toHaveCount(6)
  await page.getByLabel('Духовное родство', { exact: true }).check(); await expect(page.getByRole('status').first()).toContainText('Найдено: 12')
  await page.getByLabel('Вердикт', { exact: true }).selectOption('ALLOWED'); await expect(page.locator('.reference-card')).toHaveCount(6)
  await page.getByLabel('проверка', { exact: true }).check(); await expect(page.locator('.reference-card')).toHaveCount(3)
  await page.getByLabel('Поиск по ID, названию, описанию и источникам').fill('case-17'); await expect(page.locator('.reference-card')).toHaveCount(0)
  await expect(page.getByText('По заданным фильтрам ничего не найдено.')).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})
test('mobile PDF image sits below graph and broken images have fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: [cases[0]!.metadata, cases[1]!.metadata] }))
  await page.route('**/api/v1/references/*', route => {
    const item = route.request().url().endsWith('case-1') ? cases[0]! : cases[1]!
    return route.fulfill({ json: { ...item, metadata: { ...item.metadata, hasImage: true, source: { ...item.metadata.source, image: item.metadata.id === 'case-1' ? '/test-image.svg' : '/missing.png' } } } })
  })
  await page.route('**/test-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>' }))
  await page.route('**/missing.png', route => route.fulfill({ status: 404 }))
  await page.goto('/references'); await expect(page.getByAltText('Схема из PDF: case-1')).toBeVisible()
  await page.locator('.reference-card').nth(1).scrollIntoViewIfNeeded()
  await expect(page.getByText('Изображение источника недоступно.')).toBeAttached()
  const graph = await page.locator('.reference-graph').first().boundingBox(), image = await page.locator('figure').first().boundingBox()
  expect(image!.y).toBeGreaterThanOrEqual(graph!.y + graph!.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('error retries batch without duplicates', async ({ page }) => {
  let failed = false
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: [cases[0]!.metadata] }))
  await page.route('**/api/v1/references/*', route => {
    if (!failed) { failed = true; return route.fulfill({ status: 500 }) }
    return route.fulfill({ json: cases[0] })
  })
  await page.goto('/references'); await expect(page.getByRole('alert')).toContainText('Не удалось загрузить кейсы')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click(); await expect(page.locator('.reference-card')).toHaveCount(1)
  await expect(page.getByText('Конец списка.', { exact: true })).toBeVisible()
})

test('multiple source conclusions stay separate and the original image can be selected', async ({ page }) => {
  const item = cases[0]!
  const sources = [
    { id: 'first', title: 'Источник первый', page: 1, verdict: 'FORBIDDEN', conclusion: 'Первый вывод', image: '/source-one.svg' },
    { id: 'second', title: 'Источник второй', page: 2, verdict: 'ALLOWED', conclusion: 'Другой вывод', image: '/source-two.svg' },
  ]
  const detail = { ...item, metadata: { ...item.metadata, sources, hasImage: true } }
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: [detail.metadata] }))
  await page.route('**/api/v1/references/*', route => route.fulfill({ json: detail }))
  await page.route('**/source-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" />' }))
  await page.goto('/references')
  const card = page.locator('.reference-card')
  await expect(card).toContainText('Первый вывод')
  await expect(card).toContainText('Другой вывод')
  await expect(card.getByAltText('Схема из PDF: case-1', { exact: true })).toHaveAttribute('src', '/source-one.svg')
  await card.getByRole('combobox', { name: 'Источник схемы', exact: true }).selectOption('second')
  await expect(card.getByAltText('Схема из PDF: case-1', { exact: true })).toHaveAttribute('src', '/source-two.svg')
  await expect(card.locator('.catalog-verdict')).toHaveText('Запрещено')
})
