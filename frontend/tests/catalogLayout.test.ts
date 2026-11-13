import { catalogFixture } from './catalogFixture'
import { expect, it } from 'vitest'
import { catalogGraph } from '../src/domain/catalog'
import { layoutCatalog, compactNode } from '../src/domain/catalogLayout'
import { RelationType as R } from '../src/api/generated/models/RelationType'
import type { SearchRequest } from '../src/api/generated/models/SearchRequest'
const catalog: (SearchRequest & { id: string })[] = catalogFixture(true)
const parent = (from: string, to: string) => ({ from, to, type: R.BIOLOGICAL })
const marriage = (from: string, to: string) => ({ from, to, type: R.MARRIAGE })
function graph(ids: string[], relations: SearchRequest['relations']): SearchRequest {
  return { persons: ids.map(id => ({ id })), relations, personA: ids[0]!, personB: ids[ids.length - 1]! }
}
function valid(input: SearchRequest) {
  const before = JSON.stringify(input)
  input.persons.forEach(Object.freeze); input.relations.forEach(Object.freeze)
  Object.freeze(input.persons); Object.freeze(input.relations); Object.freeze(input)
  const result = catalogGraph(input)
  expect(JSON.stringify(input)).toBe(before)
  expect(result.nodes.map(n => n.id)).toEqual(input.persons.map(p => p.id))
  expect(result.edges.map(e => [e.source, e.target])).toEqual(input.relations.map(r => [r.from, r.to]))
  for (const node of result.nodes) {
    expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true)
    expect(node.position.y + compactNode.height).toBeLessThanOrEqual(result.height)
    expect(node.position.x + compactNode.width).toBeLessThanOrEqual(result.width)
    for (const other of result.nodes.filter(n => n.id !== node.id))
      expect(Math.abs(node.position.x - other.position.x) >= compactNode.width || Math.abs(node.position.y - other.position.y) >= compactNode.height).toBe(true)
  }
  return result.positions
}
it('places a parent chain vertically', () => {
  const p = valid(graph(['a','b','c'], [parent('a','b'),parent('b','c')]))
  expect(p.a!.y).toBeLessThan(p.b!.y); expect(p.b!.y).toBeLessThan(p.c!.y)
  expect(p.a!.x).toBe(p.b!.x); expect(p.b!.x).toBe(p.c!.x)
})
it('centres a parent above adjacent siblings', () => {
  const p = valid(graph(['p','a','b'], [parent('p','a'),parent('p','b')]))
  expect(p.a!.y).toBe(p.b!.y); expect(p.p!.y).toBeLessThan(p.a!.y)
  expect(p.p!.x).toBe((p.a!.x + p.b!.x) / 2)
  expect(Math.abs(p.a!.x - p.b!.x)).toBeLessThan(200)
})
it('keeps cousin descendants directly under their respective branches', () => {
  const p = valid(catalog.find(r => r.id === 'blood-04')!)
  expect(p.f!.y).toBe(p.m!.y); expect(p.a!.y).toBe(p.b!.y)
  expect(p.a!.x).toBe(p.f!.x); expect(p.b!.x).toBe(p.m!.x)
})
it('blood-03 keeps n and B directly below s', () => {
  const p = valid(catalog.find(r => r.id === 'blood-03')!)
  expect(p.a!.y).toBe(p.s!.y)
  expect(p.n!.x).toBe(p.s!.x); expect(p.b!.x).toBe(p.s!.x)
  expect(p.p!.x).toBe((p.a!.x + p.s!.x) / 2)
  expect(p.s!.y).toBeLessThan(p.n!.y); expect(p.n!.y).toBeLessThan(p.b!.y)
})
it('aligns multiple spouses and co-parents without adding generations', () => {
  const p = valid(graph(['p','s1','s2','a','b'], [marriage('p','s1'),marriage('s2','p'),parent('p','a'),parent('s1','a'),parent('s2','b')]))
  expect(p.p!.y).toBe(p.s1!.y); expect(p.p!.y).toBe(p.s2!.y)
  expect(p.a!.y).toBe(p.b!.y); expect(p.a!.y).toBeGreaterThan(p.p!.y)
  expect(p.p!.x).toBeGreaterThan(Math.min(p.s1!.x,p.s2!.x)); expect(p.p!.x).toBeLessThan(Math.max(p.s1!.x,p.s2!.x))
})
it('keeps multiple parents above their child even with unequal ancestral paths', () => {
  const p = valid(graph(['a','b','c','d'], [parent('a','b'),parent('b','d'),parent('c','d')]))
  expect(p.c!.y).toBe(p.b!.y); expect(p.d!.y).toBeGreaterThan(p.b!.y)
})
it('places godchildren below godparents with downward arrows like parent-child links', () => {
  const input = graph(['a','b','c'], [{ from:'a',to:'b',type:R.SPIRITUAL },{ from:'b',to:'c',type:R.SPIRITUAL }])
  const p = valid(input)
  expect(p.b!.y - p.a!.y).toBe(compactNode.height + 58)
  expect(p.c!.y - p.b!.y).toBe(compactNode.height + 58)
  expect(p.a!.x).toBe(p.b!.x); expect(p.b!.x).toBe(p.c!.x)
  expect(layoutCatalog(input).levels).toBe(3)
  for (const edge of catalogGraph(input).edges) {
    expect(edge.sourceHandle).toBe('spiritual-source')
    expect(edge.targetHandle).toBe('spiritual-target')
    expect(edge.markerEnd).toBeDefined()
  }
  const mixed = valid(catalog.find(r => r.id === 'spiritual-forbidden-02')!)
  expect(mixed.mother!.y).toBeLessThan(mixed.godchild!.y)
})
it('adoption advances generations and retains its dashed style', () => {
  const input = graph(['p','c'], [{ from:'p',to:'c',type:R.ADOPTION }]), p = valid(input)
  expect(p.c!.y).toBeGreaterThan(p.p!.y)
  expect(catalogGraph(input).edges[0]!.style).toHaveProperty('strokeDasharray','3 4')
})
it('cycles and contradictory marriages retain every node and relation', () => {
  valid(graph(['a','b','c'], [parent('a','b'),parent('b','c'),parent('c','a'),marriage('a','b')]))
  const p = valid(graph(['a','b','c'], [parent('a','b'),parent('b','c'),marriage('a','c')]))
  expect(p.a!.y).toBeLessThan(p.b!.y); expect(p.b!.y).toBeLessThan(p.c!.y)
})
it('all real references retain original data and parent direction', () => {
  for (const reference of catalog) {
    const p = valid(reference)
    for (const r of reference.relations.filter(r => r.type !== R.MARRIAGE))
      expect(p[r.from]!.y).toBeLessThan(p[r.to]!.y)
  }
})
it('routes a reversed marriage from the facing sides and keeps adoption ports distinct', () => {
  const horizontal = catalogGraph(graph(['a','b'], [marriage('b','a')])).edges[0]!
  expect(horizontal.sourceHandle).toBe('left-source'); expect(horizontal.targetHandle).toBe('right-target')
  expect(horizontal.markerEnd).toBeUndefined()
  const input = graph(['p','c'], [parent('p','c'), { from:'p',to:'c',type:R.ADOPTION }, { from:'p',to:'c',type:R.SPIRITUAL }])
  const edges = catalogGraph(input).edges
  expect(new Set(edges.map(e => e.sourceHandle)).size).toBe(3)
  expect(edges[2]!.markerEnd).toBeDefined()
})

it('keeps each spouse’s descendants below that spouse, including unequal branch lengths', () => {
  for (const id of ['affinity-forbidden-05', 'affinity-forbidden-06', 'affinity-forbidden-07', 'affinity-forbidden-08',
    'affinity-forbidden-14', 'affinity-forbidden-15', 'affinity-forbidden-33', 'affinity-allowed-06', 'affinity-allowed-07']) {
    const input = catalog.find(r => r.id === id)!, p = valid(input)
    for (const r of input.relations.filter(r => r.type === R.BIOLOGICAL)) {
      expect(p[r.to]!.y - p[r.from]!.y, id).toBe(compactNode.height + 58)
      expect(p[r.to]!.x, id).toBeCloseTo(p[r.from]!.x, 5)
    }
  }
})

it('places the godparent beside the biological parent without changing the original spiritual graph', () => {
  const input = catalog.find(r => r.id === 'spiritual-allowed-01')!, p = valid(input)
  expect(p.a!.y).toBe(p.parent!.y)
  expect(p.a!.y).toBe(p.b!.y)
  expect(p.child!.y - p.parent!.y).toBe(compactNode.height + 58)
  expect(p.a!.y).toBeLessThan(p.child!.y)
})

it('aligns both families around a marriage even when only one family has a recorded grandparent', () => {
  const p = valid(catalog.find(r => r.id === 'affinity-two-marriages-forbidden-03')!)
  expect(p.brotherparent!.y).toBe(p.s1!.y)
  expect(p.pavel!.y).toBe(p.petr!.y)
  expect(p.petr!.y).toBe(p.maria!.y)
  expect(p.petr!.y - p.brotherparent!.y).toBe(compactNode.height + 58)
})

it('keeps spouses in their families’ order so unrelated parent branches do not cross', () => {
  for (const id of ['affinity-two-marriages-forbidden-01', 'affinity-two-marriages-forbidden-02', 'affinity-two-marriages-forbidden-03']) {
    const input = catalog.find(r => r.id === id)!, p = valid(input)
    const links = input.relations.filter(r => r.type === R.BIOLOGICAL)
    for (const a of links) for (const b of links) {
      if (a.from === b.from || a.to === b.to || p[a.from]!.y !== p[b.from]!.y || p[a.to]!.y !== p[b.to]!.y) continue
      expect((p[a.from]!.x - p[b.from]!.x) * (p[a.to]!.x - p[b.to]!.x), id).toBeGreaterThanOrEqual(0)
    }
  }
})

it('keeps parents above children when ancestral paths imply conflicting generation distances', () => {
  const input = graph(['a', 'b', 'c'], [parent('a', 'b'), parent('b', 'c'), parent('a', 'c')])
  const p = valid(input)
  for (const r of input.relations) expect(p[r.from]!.y).toBeLessThan(p[r.to]!.y)
})

it('does not align a godparent with a biological parent who is their descendant', () => {
  const p = valid(graph(['a', 'b', 'c'], [parent('a', 'b'), parent('b', 'c'), { from: 'a', to: 'c', type: R.SPIRITUAL }]))
  expect(p.a!.y).toBeLessThan(p.b!.y)
  expect(p.b!.y).toBeLessThan(p.c!.y)
})
