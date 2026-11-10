import { expect, it } from 'vitest'
import { catalogGraph, filterCatalog } from '../src/domain/catalog'
import { RelationCategory as C } from '../src/api/generated/models/RelationCategory'
import { VerdictDto as V } from '../src/api/generated/models/VerdictDto'
import { RelationType as R } from '../src/api/generated/models/RelationType'
import { compactNode } from '../src/domain/catalogLayout'
import type { ReferenceSummaryDto } from '../src/api/generated/models/ReferenceSummaryDto'
const entries: ReferenceSummaryDto[] = [
  { id: 'mixed', description: 'Мать крестника', categories: new Set([C.BLOOD, C.SPIRITUAL]), tags: new Set(['схема']), verdict: V.FORBIDDEN, source: { document: 'Москва', page: 121, example: null, conclusion: null }, hasImage: false },
  { id: 'affinity', categories: new Set([C.AFFINITY]), tags: new Set(), verdict: V.ALLOWED, source: { document: 'Книга', page: 61, example: null, conclusion: null }, hasImage: false },
]
const filters = { query: '', categories: [], tags: [], verdict: '' }
it('combines search categories verdict and tags over the catalog', () => {
  for (const query of [' МОСКВА ', 'мать', 'mixed']) expect(filterCatalog(entries, { ...filters, query })).toEqual([entries[0]])
  expect(filterCatalog(entries, { ...filters, categories: [C.BLOOD, C.AFFINITY] })).toEqual(entries)
  expect(filterCatalog(entries, { ...filters, categories: [C.SPIRITUAL], verdict: 'ALLOWED' })).toEqual([])
  expect(filterCatalog(entries, { ...filters, tags: ['схема'], verdict: 'FORBIDDEN' })).toEqual([entries[0]])
})
it('preserves all nodes links A B and full height at five and twenty levels', () => {
  for (const count of [5, 20]) {
    const persons = Array.from({ length: count }, (_, i) => ({ id: `p${i}` }))
    const relations = persons.slice(1).map((p, i) => ({ type: R.BIOLOGICAL, from: persons[i]!.id, to: p.id }))
    const layout = catalogGraph({ persons, relations, personA: 'p0', personB: `p${count - 1}` })
    expect(layout.levels).toBe(count); expect(layout.height).toBeGreaterThan((count - 1) * (compactNode.height + 58) + compactNode.height)
    expect(layout.nodes).toHaveLength(count); expect(layout.edges).toHaveLength(count - 1)
    expect(layout.nodes[0]!.data.role).toBe('A'); expect(layout.nodes[count - 1]!.data.role).toBe('B')
    expect(new Set(layout.nodes.map(n => `${n.position.x}:${n.position.y}`)).size).toBe(count)
  }
})
it('preserves spouses and cycles', () => {
  const layout = catalogGraph({ persons: ['a','b','c'].map(id => ({ id })), personA: 'a', personB: 'b', relations: [
    { type: R.MARRIAGE, from: 'a', to: 'b' }, { type: R.BIOLOGICAL, from: 'a', to: 'c' }, { type: R.BIOLOGICAL, from: 'c', to: 'a' },
  ] })
  expect(layout.nodes).toHaveLength(3); expect(layout.edges).toHaveLength(3)
  expect(layout.nodes[0]!.position.y).toBe(layout.nodes[1]!.position.y)
})
