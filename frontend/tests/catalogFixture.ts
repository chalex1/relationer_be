import { readFileSync } from 'node:fs'

/** API-shaped fixtures: the original eleven regression cases, or the entire current catalog. */
export function catalogFixture(all = false) {
  const records = ['references.json', 'references-draft.json'].flatMap(name =>
    JSON.parse(readFileSync(`../backend/src/main/resources/reference-catalog/${name}`, 'utf8')))
  const ids = JSON.parse(readFileSync('../backend/src/test/resources/catalog/legacy-production.json', 'utf8')).map((record: { id: string }) => record.id)
  const selected = all ? records : ids.map((id: string) => records.find((record: { id: string }) => record.id === id))
  return selected.map((r: any) => {
    const sources = r.sources.map((s: any) => ({ ...s, image: `/api/v1/references/${r.id}/image?sourceId=${s.id}` }))
    const primary = sources[0]
    const relations = r.relations.map((relation: any) => ({
      ...relation, type: relation.type === 'ADOPTED' ? 'ADOPTION' : relation.type,
    }))
    return { ...r, relations, sources, verdict: primary.verdict, source: { ...primary, document: primary.title } }
  })
}
