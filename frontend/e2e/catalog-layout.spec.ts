import { catalogFixture } from '../tests/catalogFixture'
import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
async function mock(page: Page, id: string, verdicts?: string[]) {
  const records = catalogFixture()
  const reference = records.find((r: { id: string }) => r.id === id)
  const entries = (verdicts || [reference.verdict]).map((verdict, i) => ({ ...reference, id: verdicts ? `${id}-${i}` : id, verdict, hasImage: false }))
  await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: entries }))
  await page.route('**/api/v1/references/*', route => {
    const metadata = entries.find(r => route.request().url().endsWith(r.id))!
    return route.fulfill({ json: { metadata, graph: { persons: reference.persons, relations: reference.relations, personA: reference.personA, personB: reference.personB } } })
  })
}
async function contained(page: Page) {
  return page.locator('.reference-canvas').first().evaluate(canvas => {
    const box = canvas.getBoundingClientRect()
    return [...canvas.querySelectorAll('.vue-flow__node')].every(node => {
      const rect = node.getBoundingClientRect()
      return rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom
    })
  })
}
test('blood-03 groups descendants under s, fits desktop and mobile, keeps editor size', async ({ page }) => {
  await mock(page, 'blood-03'); await page.goto('/references')
  const card = page.getByRole('article', { name: 'blood-03', exact: true })
  await expect(card.locator('.vue-flow__node')).toHaveCount(5)
  await expect.poll(() => contained(page)).toBe(true)
  const positions = await card.locator('.vue-flow__node').evaluateAll(nodes => Object.fromEntries(nodes.map(node => {
    const rect = node.getBoundingClientRect()
    return [node.getAttribute('data-id'), { x: rect.x, y: rect.y }]
  })))
  expect(positions.n!.x).toBeCloseTo(positions.s!.x, 1)
  expect(positions.b!.x).toBeCloseTo(positions.s!.x, 1)
  expect(positions.a!.y).toBeCloseTo(positions.s!.y, 1)
  expect(await card.locator('.person-node').first().evaluate(node => (node as HTMLElement).offsetWidth)).toBe(132)
  await mkdir('artifacts/layout', { recursive: true })
  await card.screenshot({ path: 'artifacts/layout/blood-03-after.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => contained(page)).toBe(true)
  await card.screenshot({ path: 'artifacts/layout/blood-03-mobile.png' })
  await expect(card.locator('.reference-canvas .vue-flow__controls')).toHaveCount(0)
  const beforeZoom = await card.locator('.vue-flow__transformationpane').getAttribute('style')
  await card.getByRole('button', { name: 'Увеличить граф', exact: true }).click()
  await expect.poll(() => card.locator('.vue-flow__transformationpane').getAttribute('style')).not.toBe(beforeZoom)
  await card.getByRole('button', { name: 'Показать весь граф', exact: true }).click()
  await expect.poll(() => contained(page)).toBe(true)
  await card.getByRole('button', { name: 'Развернуть граф' }).click()
  await expect(page.locator('dialog[open] .vue-flow__node')).toHaveCount(5)
  await page.getByRole('button', { name: 'Закрыть граф' }).click()
  await expect.poll(() => contained(page)).toBe(true)
  await page.goto('/')
  await expect(page.locator('.person-node').first()).toBeVisible()
  expect(await page.locator('.person-node').first().evaluate(node => (node as HTMLElement).offsetWidth)).toBe(200)
})
test('catalog verdict tags reuse red green and yellow palette', async ({ page }) => {
  await mock(page, 'blood-03', ['FORBIDDEN','ALLOWED','UNDETERMINED']); await page.goto('/references')
  const badges = page.locator('.catalog-verdict')
  await expect(badges).toHaveText(['Запрещено','Разрешено','Не определено'])
  await expect(badges.nth(0)).toHaveCSS('background-color','rgb(252, 236, 233)')
  await expect(badges.nth(1)).toHaveCSS('background-color','rgb(231, 244, 233)')
  await expect(badges.nth(2)).toHaveCSS('background-color','rgb(255, 244, 207)')
})
