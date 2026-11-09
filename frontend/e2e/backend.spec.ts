import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import type { SearchResponse } from '../src/api/generated/models/SearchResponse'

// Opt-in: no route mocks. Requests pass through Vite to a running Spring Boot.
test.skip(process.env.RUN_BACKEND_INTEGRATION !== '1', 'Requires a running backend; see docs/day9-integration.md')
async function parent(page: Page) {
  await page.getByRole('button', { name: 'Добавить родственника', exact: true }).click()
  await page.getByRole('button', { name: 'Родителя', exact: true }).click()
}
async function connect(page: Page, id: string, role: string) {
  await page.getByRole('button', { name: 'Связать с существующим', exact: true }).click()
  await page.getByLabel('Выберите человека', { exact: true }).selectOption(id)
  await page.getByLabel('Кем этот человек приходится', { exact: false }).selectOption(role)
  await page.getByRole('button', { name: 'Добавить связь', exact: true }).click()
}
async function search(page: Page): Promise<SearchResponse> {
  const response = page.waitForResponse(r => r.url().endsWith('/api/v1/references/search') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click()
  const actual = await response
  expect(actual.status()).toBe(200)
  return actual.json()
}

test('real catalogue A: common parent matches blood-01 through blood-05', async ({ page }) => {
  await page.goto('/'); await parent(page); await connect(page, 'person-b', 'child')
  const result = await search(page)
  expect(result.matches.map(m => m.referenceId)).toEqual(['blood-01', 'blood-02', 'blood-03', 'blood-04', 'blood-05'])
  expect(result.matches.every(m => m.verdict === 'FORBIDDEN' && m.userPathCode === '<BB>')).toBe(true)
  await expect(page.locator('.match-card')).toHaveCount(5)
  await expect(page.locator('.match-card').first()).toContainText('blood-01')
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/search-real-bb.png', fullPage: true })
})

test('real catalogue B: children of different married parents have no current matches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/'); await parent(page)
  const firstParent = await page.locator('.app-shell').evaluate(el => {
    const component = (el as HTMLElement & { __vueParentComponent: { devtoolsRawSetupState: { editor: { graph: { persons: { id: string }[] } } } } }).__vueParentComponent
    return component.devtoolsRawSetupState.editor.graph.persons[2].id
  })
  await page.getByRole('button', { name: 'Выбрать участника B: Персона B', exact: true }).click()
  await parent(page); await connect(page, firstParent, 'spouse')
  expect(await search(page)).toEqual({ matches: [] })
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Это не означает разрешения')
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/search-real-bmb-empty-mobile.png', fullPage: true })
})

test('real catalogue C: disconnected A/B return an empty result', async ({ page }) => {
  await page.goto('/')
  expect(await search(page)).toEqual({ matches: [] })
  await expect(page.locator('.match-card')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Результаты поиска' })).toContainText('Совпадений в справочнике не найдено')
})
