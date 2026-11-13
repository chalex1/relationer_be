import { catalogFixture } from '../tests/catalogFixture'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { mockCatalogImages } from './catalogImages'

const originals = catalogFixture()
const makeDrafts = () => originals.slice(0, 2).map((r: any, i: number) => ({
  metadata: { ...r, id: `draft-${i + 1}`, hasImage: true },
  graph: { persons: r.persons, relations: r.relations, personA: r.personA, personB: r.personB },
}))
async function mock(page: Page, drafts: () => ReturnType<typeof makeDrafts>) {
  await mockCatalogImages(page)
  await page.route('**/api/v1/references/*', route => {
    const draft = drafts().find((d: any) => route.request().url().endsWith(d.metadata.id))
    if (draft) return route.fulfill({ json: draft })
    const r = originals.find((r: any) => route.request().url().endsWith(r.id))
    return route.fulfill({ json: { metadata: { ...r, hasImage: true }, graph: r } })
  })
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('catalog') === 'draft' ? drafts().map((d: any) => d.metadata) : originals.map((r: any) => ({ ...r, hasImage: true })) }))
}

test('switch catalogs, review, reload, filter, export and import results', async ({ page }) => {
  await mock(page, makeDrafts)
  await page.goto('/references')
  await expect(page.locator('.reference-card')).toHaveCount(10)
  await page.getByLabel('На проверке', { exact: true }).check()
  const first = page.getByRole('article', { name: 'draft-1', exact: true })
  const second = page.getByRole('article', { name: 'draft-2', exact: true })
  await expect(page.locator('.reference-card')).toHaveCount(2)
  await expect(first.locator('.vue-flow__node')).toHaveCount(3)
  await expect(first.getByAltText('Схема из PDF: draft-1', { exact: true })).toBeVisible()
  await first.getByRole('button', { name: 'Увеличить оригинал: draft-1', exact: true }).click()
  await expect(first.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await first.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('REVIEWED')
  await second.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('NEEDS_CORRECTION')
  await second.getByLabel('Комментарий к отклонению (необязательно)').fill('Нужно проверить имя участницы')
  await expect(page.locator('.review-counts')).toContainText('Одобрены: 1 · Отклонены: 1')
  await expect(first.locator('.catalog-verdict')).toHaveText('Запрещено')
  await page.reload(); await page.getByLabel('На проверке', { exact: true }).check()
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('REVIEWED')
  await expect(second.getByLabel('Комментарий к отклонению (необязательно)')).toHaveValue('Нужно проверить имя участницы')
  await page.getByRole('combobox', { name: 'Статус проверки (фильтр)', exact: true }).selectOption('NEEDS_CORRECTION')
  await expect(page.locator('.reference-card')).toHaveCount(1)
  await expect(second).toBeVisible()
  await page.getByRole('combobox', { name: 'Статус проверки (фильтр)', exact: true }).selectOption('')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Экспорт результатов', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('review-results.json')
  const exported = readFileSync((await download.path())!, 'utf8')
  const data = JSON.parse(exported)
  expect(data.results).toHaveLength(2)
  expect(data.results[0]).toMatchObject({ id: 'draft-1', status: 'REVIEWED', comment: '' })
  expect(data.results[0].reviewedAt).toMatch(/^\d{4}-/)
  expect(data.results[0].fingerprint).toMatch(/^sha256-v2:/)
  await first.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('DRAFT')
  await page.getByLabel('Импорт результатов', { exact: true }).setInputFiles({ name: 'review-results.json', mimeType: 'application/json', buffer: Buffer.from(exported) })
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('REVIEWED')
  await page.getByLabel('Импорт результатов', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await expect(page.getByText('Не удалось импортировать результаты:', { exact: false })).toBeVisible()
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('REVIEWED')
  await page.getByLabel('Рабочие', { exact: true }).check()
  await expect(page.locator('.reference-card')).toHaveCount(10)
  await expect(page.locator('.draft-review')).toHaveCount(0)
})

test('changed draft loses approval after reload and import until explicitly reviewed again', async ({ page }) => {
  let drafts = makeDrafts()
  await mock(page, () => drafts)
  await page.goto('/references'); await page.getByLabel('На проверке', { exact: true }).check()
  const first = page.getByRole('article', { name: 'draft-1', exact: true })
  await first.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('REVIEWED')
  const saved = await page.evaluate(() => localStorage.getItem('relationer.reference-reviews.v1'))
  drafts = structuredClone(drafts)
  drafts[0]!.graph.persons[0]!.name = 'Изменившийся участник'
  await page.reload(); await page.getByLabel('На проверке', { exact: true }).check()
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('DRAFT')
  await expect(first).toContainText('Требует повторной проверки.')
  await expect(page.locator('.review-counts')).toContainText('Одобрены: 0')
  await page.getByLabel('Импорт результатов', { exact: true }).setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(saved!) })
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('DRAFT')
  await first.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('REVIEWED')
  await expect(first.locator('.review-changed')).toHaveCount(0)
  await page.reload(); await page.getByLabel('На проверке', { exact: true }).check()
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('REVIEWED')
})

test('draft API failure and late responses do not replace the working catalog', async ({ page }) => {
  await mock(page, makeDrafts)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/references?catalog=draft', async route => { await gate; await route.fulfill({ status: 503, json: { message: 'Draft catalog unavailable' } }) })
  await page.goto('/references'); await page.getByLabel('На проверке', { exact: true }).check()
  await page.getByLabel('Рабочие', { exact: true }).check(); release()
  await expect(page.locator('.reference-card')).toHaveCount(10)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('На проверке', { exact: true }).check()
  await expect(page.getByRole('alert')).toContainText('Переключитесь на рабочий каталог или повторите попытку.')
  await page.unroute('**/api/v1/references?catalog=draft')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.locator('.reference-card')).toHaveCount(2)
})

test('mobile drafts survive unavailable storage and still allow review and export', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable') } })
  await mock(page, makeDrafts)
  await page.goto('/references'); await page.getByLabel('На проверке', { exact: true }).check()
  const first = page.getByRole('article', { name: 'draft-1', exact: true })
  await first.getByRole('combobox', { name: 'Статус проверки', exact: true }).selectOption('REVIEWED')
  await expect(page.getByText('Отметки сохранены только до закрытия страницы.', { exact: false })).toBeVisible()
  await expect(first.getByRole('combobox', { name: 'Статус проверки', exact: true })).toHaveValue('REVIEWED')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Экспорт результатов', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('review-results.json')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
