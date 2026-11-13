import { catalogFixture } from '../tests/catalogFixture'
import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { mockCatalogImages } from './catalogImages'
async function mock(page: Page, id: string, verdicts?: string[]) {
  await mockCatalogImages(page)
  const records = catalogFixture(true)
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

test('three-family affinity has a readable badge and filter label', async ({ page }) => {
  await mock(page, 'three-family-allowed-01'); await page.goto('/references')
  await expect(page.locator('.reference-badges').getByText('Трехродное свойство', { exact: true })).toBeVisible()
  await expect(page.getByText('#трехродное свойство', { exact: true })).toHaveCount(0)
  await page.getByLabel('Трехродное свойство', { exact: true }).check()
  await expect(page.locator('.reference-card')).toHaveCount(1)
})

for (const id of ['affinity-allowed-01', 'affinity-allowed-02', 'affinity-allowed-03',
  'affinity-forbidden-05', 'affinity-forbidden-06', 'affinity-forbidden-07', 'affinity-forbidden-08',
  'affinity-forbidden-14', 'affinity-forbidden-15', 'affinity-forbidden-33', 'affinity-allowed-06', 'affinity-allowed-07',
  'affinity-two-marriages-forbidden-01', 'affinity-two-marriages-forbidden-02', 'affinity-two-marriages-forbidden-03',
  ...catalogFixture(true).filter((entry: { id: string }) => entry.id.startsWith('spiritual-') || entry.id.startsWith('appendix-spiritual-')).map((entry: { id: string }) => entry.id),
  'adoption-forbidden-01']) {
  test(`${id}: reviewed layout fits desktop and mobile and keeps links clear of people`, async ({ page }) => {
    await mock(page, id); await page.goto('/references')
    const card = page.getByRole('article', { name: id, exact: true })
    const record = catalogFixture(true).find((r: { id: string }) => r.id === id)
    await expect(card.locator('.vue-flow__node')).toHaveCount(record.persons.length)
    await expect(card.locator(`.vue-flow__node[data-id="${record.personA}"] .role-a`)).toHaveCount(1)
    await expect(card.locator(`.vue-flow__node[data-id="${record.personB}"] .role-b`)).toHaveCount(1)
    await expect(card.locator('.vue-flow__edge-path')).toHaveCount(record.relations.length)
    await expect.poll(() => contained(page)).toBe(true)
    const collisions = () => card.evaluate((element, relations: { type: string; from: string; to: string }[]) => {
      const nodes = [...element.querySelectorAll('.vue-flow__node')]
      const result: string[] = []
      for (const [index, relation] of relations.entries()) {
        const path = element.querySelector<SVGPathElement>(`.vue-flow__edge[data-id="relation-${index}"] .vue-flow__edge-path`)!
        if (relation.type === 'SPIRITUAL') {
          const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength())
          if (end.y <= start.y || !path.getAttribute('marker-end')) result.push(`${relation.from} → ${relation.to} must have a downward baptism arrow`)
        }
        const transform = path.getScreenCTM()!
        for (const node of nodes) {
          const id = node.getAttribute('data-id')!
          if (id === relation.from || id === relation.to) continue
          const rect = node.getBoundingClientRect()
          for (let distance = 0; distance < path.getTotalLength(); distance += 2) {
            const point = path.getPointAtLength(distance).matrixTransform(transform)
            if (point.x > rect.left + 1 && point.x < rect.right - 1 && point.y > rect.top + 1 && point.y < rect.bottom - 1) {
              result.push(`${relation.from} → ${relation.to} crosses ${id}`); break
            }
          }
        }
      }
      // Unrelated parent branches must not cross or share a horizontal run.
      // Sampling in SVG coordinates keeps this check independent of zoom.
      const biological = relations.map((relation, index) => ({ relation, index })).filter(({ relation }) => relation.type === 'BIOLOGICAL')
      for (const [i, a] of biological.entries()) for (const b of biological.slice(i + 1)) {
        if (a.relation.from === b.relation.from || a.relation.to === b.relation.to || a.relation.from === b.relation.to || a.relation.to === b.relation.from) continue
        const pathA = element.querySelector<SVGPathElement>(`.vue-flow__edge[data-id="relation-${a.index}"] .vue-flow__edge-path`)!
        const pathB = element.querySelector<SVGPathElement>(`.vue-flow__edge[data-id="relation-${b.index}"] .vue-flow__edge-path`)!
        for (let distance = 0; distance <= pathA.getTotalLength(); distance += 1) {
          if (pathB.isPointInStroke(pathA.getPointAtLength(distance))) {
            result.push(`${a.relation.from} → ${a.relation.to} intersects ${b.relation.from} → ${b.relation.to}`); break
          }
        }
      }
      return result
    }, record.relations)
    await expect.poll(collisions).toEqual([])
    await mkdir('artifacts/layout', { recursive: true })
    await card.screenshot({ path: `artifacts/layout/${id}-desktop.png` })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => contained(page)).toBe(true)
    await expect.poll(collisions).toEqual([])
    await card.screenshot({ path: `artifacts/layout/${id}-mobile.png` })
  })
}
