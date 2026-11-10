import { readFileSync } from 'node:fs'

/** API-shaped fixture from the canonical backend catalog; no runtime data is stored in frontend. */
export function catalogFixture() {
  const records = JSON.parse(readFileSync('../backend/src/main/resources/reference-catalog/references.json', 'utf8'))
  return records.map((r: any) => {
    const sources = r.sources.map((s: any) => ({ ...s, image: `/api/v1/references/${r.id}/image?sourceId=${s.id}` }))
    const primary = sources[0]
    return { ...r, sources, verdict: primary.verdict, source: { ...primary, document: primary.title } }
  })
}
