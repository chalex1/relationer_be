import type { Page } from '@playwright/test'
import { catalogFixture } from '../tests/catalogFixture'

/** Serve the backend's original PNGs without requiring a running backend. */
export async function mockCatalogImages(page: Page) {
  const records = catalogFixture(true)
  await page.route(/\/api\/v1\/references\/[^/]+\/image(?:\?.*)?$/, route => {
    const id = new URL(route.request().url()).pathname.split('/')[4]
    const record = records.find((entry: { id: string }) => entry.id === id)
    return record
      ? route.fulfill({ contentType: 'image/png', path: `../backend/src/main/resources/reference-catalog/images/${record.id}.png` })
      : route.fulfill({ status: 404 })
  })
}
