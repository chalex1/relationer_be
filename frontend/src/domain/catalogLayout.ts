import { graphlib, layout } from '@dagrejs/dagre'
import type { SearchRequest } from '../api/generated/models/SearchRequest'
import { RelationType } from '../api/generated/models/RelationType'
import type { Point } from './editor'

// Keep these dimensions in sync with .person-node.is-compact in style.css.
export const compactNode = { width: 132, height: 52 }
const siblingGap = 38, partnerGap = siblingGap, generationGap = 58, padding = 24

/** Only biological/adoptive edges constrain generations. Marriage and shared
 * parenthood align adults when doing so does not collapse an ancestor into a
 * descendant. Dagre orders branches and centres parents over descendants.
 * All changes are confined to a fresh layout graph, including cycle reversal. */
export function layoutCatalog(graph: SearchRequest) {
  const parentLinks = graph.relations.filter(r => r.type === RelationType.BIOLOGICAL || r.type === RelationType.ADOPTION)
  const groupOf = new Map(graph.persons.map(p => [p.id, p.id]))
  function group(id: string): string {
    let current = id
    while (groupOf.get(current) !== current) current = groupOf.get(current)!
    return current
  }
  function reaches(from: string, to: string) {
    const pending = [from], seen = new Set<string>()
    while (pending.length) {
      const id = pending.pop()!
      if (id === to) return true
      if (seen.has(id)) continue
      seen.add(id)
      for (const r of parentLinks) if (group(r.from) === id && group(r.to) !== id) pending.push(group(r.to))
    }
    return false
  }
  function align(a: string, b: string) {
    const from = group(a), to = group(b)
    if (from !== to && !reaches(from, to) && !reaches(to, from)) groupOf.set(to, from)
  }
  // Co-parents share a generation, even if no marriage is recorded.
  const coParents = new Map<string, string[]>()
  for (const r of parentLinks) coParents.set(r.to, [...(coParents.get(r.to) ?? []), r.from])
  for (const adults of coParents.values()) for (const adult of adults.slice(1)) align(adults[0]!, adult)
  for (const r of graph.relations) if (r.type === RelationType.MARRIAGE) align(r.from, r.to)
  // A godparent can stand beside the child's parent. Spiritual links alone do
  // not define generations, and align still rejects ancestor/descendant pairs.
  for (const r of graph.relations) if (r.type === RelationType.SPIRITUAL) {
    for (const adult of coParents.get(r.to) ?? []) align(adult, r.from)
  }

  const groups = new Map<string, string[]>()
  for (const p of graph.persons) groups.set(group(p.id), [...(groups.get(group(p.id)) ?? []), p.id])
  const dag = new graphlib.Graph({ multigraph: true }).setGraph({
    rankdir: 'TB', ranker: 'network-simplex', acyclicer: 'greedy',
    nodesep: siblingGap, ranksep: generationGap, edgesep: 14, marginx: padding, marginy: padding,
  }).setDefaultEdgeLabel(() => ({}))
  // Put the person with the most partners near the middle of a marriage group.
  // A chain of two marriages then has both partners adjacent to the shared person.
  const partners = new Map(graph.persons.map(p => [p.id, new Set<string>()]))
  for (const r of graph.relations) if (r.type === RelationType.MARRIAGE) {
    partners.get(r.from)!.add(r.to); partners.get(r.to)!.add(r.from)
  }
  for (const [id, members] of groups) {
    if (members.length > 2) {
      const centre = [...members].sort((a, b) => partners.get(b)!.size - partners.get(a)!.size)[0]!
      members.splice(members.indexOf(centre), 1)
      members.splice(Math.floor(members.length / 2), 0, centre)
    }
    dag.setNode(id, { width: members.length * compactNode.width + (members.length - 1) * partnerGap, height: compactNode.height })
  }
  parentLinks.forEach((r, i) => dag.setEdge(group(r.from), group(r.to), { weight: 2, minlen: 1 }, `parent-${i}`))
  layout(dag)

  // Dagre may align leaves at the bottom even when their ancestral paths have
  // different lengths. Solve generation differences in both directions so a
  // marriage also aligns the two families' siblings and parents.
  const ranks = new Map<string, number>()
  if (graphlib.alg.isAcyclic(dag)) {
    for (const id of graphlib.alg.topsort(dag)) {
      const rank = Math.max(0, ...(dag.predecessors(id) ?? []).map(parent => ranks.get(parent)! + 1))
      ranks.set(id, rank)
    }
    const visited = new Set<string>()
    for (const start of groups.keys()) {
      if (visited.has(start)) continue
      const relative = new Map([[start, 0]]), pending = [start]
      let consistent = true
      for (let index = 0; index < pending.length; index++) {
        const id = pending[index]!, rank = relative.get(id)!
        const neighbours: [string, number][] = [
          ...(dag.successors(id) ?? []).map(child => [child, rank + 1] as [string, number]),
          ...(dag.predecessors(id) ?? []).map(parent => [parent, rank - 1] as [string, number]),
        ]
        for (const [neighbour, expected] of neighbours) {
          if (relative.has(neighbour)) { if (relative.get(neighbour) !== expected) consistent = false }
          else { relative.set(neighbour, expected); pending.push(neighbour) }
        }
      }
      const minimum = Math.min(...relative.values())
      for (const [id, rank] of relative) {
        visited.add(id)
        if (consistent) ranks.set(id, rank - minimum)
      }
    }
    for (const [id, rank] of ranks) dag.node(id).y = padding + compactNode.height / 2 + rank * (compactNode.height + generationGap)
  }

  const memberOffset = new Map<string, number>()
  for (const members of groups.values()) members.forEach((id, index) => memberOffset.set(id, index * (compactNode.width + partnerGap)))
  const left = (id: string) => dag.node(id).x! - dag.node(id).width / 2
  const personX = (id: string) => left(group(id)) + memberOffset.get(id)!
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const rows = new Map<number, string[]>()
  for (const id of groups.keys()) {
    const y = dag.node(id).y!
    rows.set(y, [...(rows.get(y) ?? []), id])
  }
  const orderedRows = [...rows.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids.sort((a, b) => left(a) - left(b)))

  // Fit each row to its preferred positions without overlapping blocks. Pooling
  // adjacent violations distributes the required spacing across both branches.
  function placeRow(ids: string[], preferred: Map<string, number>) {
    ids.sort((a, b) => preferred.get(a)! - preferred.get(b)! || left(a) - left(b))
    let offset = 0
    const offsets: number[] = []
    const pools: { start: number; end: number; sum: number; count: number }[] = []
    ids.forEach((id, index) => {
      offsets.push(offset)
      pools.push({ start: index, end: index, sum: preferred.get(id)! - offset, count: 1 })
      while (pools.length > 1) {
        const b = pools[pools.length - 1]!, a = pools[pools.length - 2]!
        if (a.sum / a.count <= b.sum / b.count) break
        pools.splice(-2, 2, { start: a.start, end: b.end, sum: a.sum + b.sum, count: a.count + b.count })
      }
      offset += dag.node(id).width + siblingGap
    })
    for (const pool of pools) for (let i = pool.start; i <= pool.end; i++) {
      const node = dag.node(ids[i]!)
      node.x = pool.sum / pool.count + offsets[i]! + node.width / 2
    }
  }
  if (ranks.size) {
    // Connect the actual people inside a couple block, rather than routing all
    // of their independent descendants through the centre of the whole block.
    if ([...groups.values()].some(members => members.length > 1)) {
      for (let pass = 0; pass < 4; pass++) for (const downward of [false, true]) {
        for (const ids of downward ? orderedRows : [...orderedRows].reverse()) {
          const preferred = new Map(ids.map(id => {
            const links = parentLinks.filter(r => group(downward ? r.to : r.from) === id)
            const values = links.map(r => downward
              ? personX(r.from) - memberOffset.get(r.to)!
              : personX(r.to) - memberOffset.get(r.from)!)
            return [id, values.length ? mean(values) : left(id)]
          }))
          placeRow(ids, preferred)
        }
      }
    }
    // Shorter branches now share rows with nodes previously on different rows.
    for (const ids of orderedRows) placeRow(ids, new Map(ids.map(id => [id, left(id)])))
  }
  const shift = padding - Math.min(...[...groups.keys()].map(left))
  for (const id of groups.keys()) dag.node(id).x! += shift

  const positions: Record<string, Point> = Object.create(null)
  for (const [id, members] of groups) {
    const node = dag.node(id)
    members.forEach((member, i) => {
      positions[member] = { x: node.x! - node.width / 2 + i * (compactNode.width + partnerGap), y: node.y! - compactNode.height / 2 }
    })
  }
  const levels = new Set(Object.values(positions).map(p => p.y)).size
  return {
    positions, levels,
    width: Math.max(0, ...Object.values(positions).map(p => p.x + compactNode.width)) + padding,
    height: Math.max(200, ...Object.values(positions).map(p => p.y + compactNode.height + padding + 30)),
  }
}
