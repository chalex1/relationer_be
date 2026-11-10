import { catalogFixture } from '../tests/catalogFixture'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const records = catalogFixture()

for (const width of [1440, 390]) {
  test(`all original PNGs load, fit and enlarge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.route(/\/api\/v1\/references(?:\?.*)?$/, route => route.fulfill({ json: records.map((r: any) => ({ ...r, hasImage: true })) }))
    await page.route('**/api/v1/references/*', route => {
      const record = records.find((r: any) => route.request().url().endsWith(r.id))
      return route.fulfill({ json: { metadata: { ...record, hasImage: true }, graph: record } })
    })
    await page.goto('/references')
    await expect(page.locator('.reference-card')).toHaveCount(10)
    await page.locator('.feed-sentinel').scrollIntoViewIfNeeded()
    await expect(page.locator('.reference-card')).toHaveCount(11)
    for (const record of records) {
      const card = page.getByRole('article', { name: record.id, exact: true })
      const image = card.getByAltText(`Схема из PDF: ${record.id}`, { exact: true })
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      const size = await image.evaluate((img: HTMLImageElement) => ({ rendered: img.width / img.height, natural: img.naturalWidth / img.naturalHeight }))
      expect(Math.abs(size.rendered - size.natural)).toBeLessThan(0.01)
      await expect(card.getByRole('heading', { name: 'Граф Relationer', exact: true })).toBeAttached()
      await expect(card.getByRole('heading', { name: 'Оригинал из PDF', exact: true })).toBeAttached()
      await expect.poll(() => card.locator('.reference-canvas').evaluate(canvas => {
        const box = canvas.getBoundingClientRect()
        return [...canvas.querySelectorAll('.vue-flow__node')].every(node => {
          const r = node.getBoundingClientRect()
          return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom
        })
      })).toBe(true)
      const graph = await card.locator('.reference-graph-panel').boundingBox()
      const panel = await card.locator('.reference-image-panel').boundingBox()
      if (width > 760) expect(panel!.x).toBeGreaterThanOrEqual(graph!.x + graph!.width)
      else expect(panel!.y).toBeGreaterThanOrEqual(graph!.y + graph!.height)
      await card.getByRole('button', { name: `Увеличить оригинал: ${record.id}`, exact: true }).click()
      const dialog = card.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByAltText(`Увеличенная схема: ${record.id}`)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(card.getByRole('button', { name: `Увеличить оригинал: ${record.id}`, exact: true })).toBeFocused()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
