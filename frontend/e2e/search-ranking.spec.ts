import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import type { ReferenceMatchDto } from '../src/api/generated/models/ReferenceMatchDto'

function entry(id: string, changes: Partial<ReferenceMatchDto> = {}): ReferenceMatchDto {
  return { referenceId: id, verdict: 'FORBIDDEN', description: 'Тестовый пример', userPathCode: 'B>', referencePathCode: 'B>',
    reviewStatus: 'DRAFT', source: { document: 'Исторический источник', page: 1, example: null, conclusion: 'Текст источника' }, ...changes }
}
const confirmed = [{ id: 'confirmed', title: 'Проверенное заключение', verdict: 'FORBIDDEN' as const, conclusion: 'Явно подтверждённый текст', conclusionConfirmed: true }]
const ranked = [
  entry('hidden-allowed', { verdict: 'ALLOWED' }),
  entry('confirmed-partial-draft', { sources: confirmed, referencePathCode: '<BB>' }),
  entry('hidden-reviewed', { reviewStatus: 'REVIEWED' }),
  entry('confirmed-exact-draft', { sources: confirmed }),
  entry('confirmed-exact-reviewed', { sources: confirmed, reviewStatus: 'REVIEWED' }),
]
const endpoint = '**/api/v1/references/search'

for (const width of [1440, 390]) {
  test(`confirmed conclusion precedes exact path; remainder and contradiction stay accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.route(endpoint, route => route.fulfill({ json: { matches: ranked } }))
    await page.goto('/'); await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click()
    const results = page.getByRole('region', { name: 'Результаты поиска' })
    await expect(results.locator('.match-card')).toHaveCount(3)
    await expect(results.locator('.primary-matches .match-heading > strong')).toHaveText(['confirmed-exact-reviewed', 'confirmed-exact-draft', 'confirmed-partial-draft'])
    await expect(results.getByText('hidden-reviewed', { exact: true })).toHaveCount(0)
    await expect(results.getByText('hidden-allowed', { exact: true })).toHaveCount(0)
    const toggle = results.getByRole('button', { name: 'Смотреть остальные варианты (2)', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(results.locator('.remaining-conflict')).toBeVisible()
    await expect(toggle.locator('..')).toContainText('противоречащие показанным или друг другу')
    await expect(results.getByRole('article', { name: 'confirmed-partial-draft', exact: true })).toContainText('Частичное совпадение пути')
    await expect(results.getByRole('article', { name: 'confirmed-partial-draft', exact: true })).toContainText('Граф ещё не проверен')
    await mkdir('artifacts/ranking', { recursive: true })
    await results.screenshot({ path: `artifacts/ranking/results-${width}.png` })
    await toggle.click()
    await expect(results.locator('.match-card')).toHaveCount(5)
    await expect(results.locator('.remaining-matches .match-heading > strong')).toHaveText(['hidden-reviewed', 'hidden-allowed'])
    await expect(results.getByRole('button', { name: 'Скрыть остальные варианты', exact: true })).toHaveAttribute('aria-expanded', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Повторить поиск', exact: true }).click()
    await expect(results.locator('.match-card')).toHaveCount(3)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
}

test('no confirmed conclusions means exact drafts remain visible and graph review does not imply confirmation', async ({ page }) => {
  const matches = [entry('partial-a', { referencePathCode: '<BB>' }), entry('exact-z'), entry('exact-a'), entry('reviewed', { reviewStatus: 'REVIEWED' })]
  await page.route(endpoint, route => route.fulfill({ json: { matches } }))
  await page.goto('/'); await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click()
  const results = page.getByRole('region', { name: 'Результаты поиска' })
  await expect(results.locator('.primary-matches .match-heading > strong')).toHaveText(['reviewed', 'exact-a', 'exact-z'])
  await expect(results).toContainText('Подтверждённых заключений среди совпадений пока нет')
  await expect(results.locator('.confirmed-conclusion')).toHaveCount(0)
  await expect(results.getByRole('article', { name: 'exact-a', exact: true })).toContainText('Граф ещё не проверен')
  await expect(results.locator('.remaining-conflict')).toHaveCount(0)
})

test('opposing sources inside one case are visible and only the explicitly confirmed source is marked', async ({ page }) => {
  const matches = [entry('two-sources', { sources: [
    { id: 'historical', title: 'Исторический запрет', verdict: 'FORBIDDEN', conclusion: 'Первый вывод' },
    { id: 'verified', title: 'Иной вывод', verdict: 'ALLOWED', conclusion: 'Второй вывод', conclusionConfirmed: true },
  ] })]
  await page.route(endpoint, route => route.fulfill({ json: { matches } }))
  await page.goto('/'); await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click()
  const results = page.getByRole('region', { name: 'Результаты поиска' })
  await expect(results.locator('.conflict-note')).toContainText('и разрешённые, и запрещённые')
  const sources = results.locator('.match-source > section')
  await expect(sources.nth(0)).toContainText('Заключение этого источника не подтверждено')
  await expect(sources.nth(1)).toContainText('Заключение подтверждено отдельно от проверки графа')
  await expect(results.locator('.verdict-badge')).toHaveText('Запрещено')
})

test('unknown hidden conclusion is not labelled as a contradiction', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { matches: [entry('a'), entry('b', { verdict: 'ALLOWED' }), entry('c'), entry('d', { verdict: 'UNDETERMINED' })] } }))
  await page.goto('/'); await page.getByRole('button', { name: 'Найти совпадения', exact: true }).click()
  const results = page.getByRole('region', { name: 'Результаты поиска' })
  await expect(results.getByRole('button', { name: 'Смотреть остальные варианты (1)', exact: true })).toBeVisible()
  await expect(results.locator('.remaining-conflict')).toHaveCount(0)
  await expect(results.locator('.conflict-note')).toContainText('и разрешённые, и запрещённые')
})
