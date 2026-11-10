import { graphlib, layout } from '@dagrejs/dagre'
import type { SearchRequest } from '../api/generated/models/SearchRequest'
import { RelationType } from '../api/generated/models/RelationType'
import type { Point } from './editor'

// Keep these dimensions in sync with .person-node.is-compact in style.css.
export const compactNode = { width: 132, height: 52 }
const siblingGap = 38, partnerGap = 24, generationGap = 58, padding = 24

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
