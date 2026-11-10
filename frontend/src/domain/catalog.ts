import { MarkerType } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import type { ReferenceSummaryDto } from '../api/generated/models/ReferenceSummaryDto'
import type { SearchRequest } from '../api/generated/models/SearchRequest'
import type { RelationCategory } from '../api/generated/models/RelationCategory'
import { RelationType } from '../api/generated/models/RelationType'
import { typePresentation } from './graphPresentation'
import { layoutCatalog, compactNode } from './catalogLayout'

export interface CatalogFilters { query: string; categories: RelationCategory[]; tags: string[]; verdict: string }
export function filterCatalog(entries: ReferenceSummaryDto[], filters: CatalogFilters) {
  const query = filters.query.trim().toLocaleLowerCase()
  return entries.filter(entry =>
    (!query || [entry.id, entry.description, entry.source.document, entry.source.example].some(v => v?.toLocaleLowerCase().includes(query))) &&
    (!filters.categories.length || filters.categories.some(c => entry.categories.has(c))) &&
    (!filters.tags.length || filters.tags.every(t => entry.tags.has(t))) &&
    (!filters.verdict || entry.verdict === filters.verdict))
}

/** Read-only presentation; original persons, relations and participants are untouched. */
export function catalogGraph(graph: SearchRequest) {
  const result = layoutCatalog(graph)
  const nodes: Node[] = graph.persons.map(p => ({
    id: p.id, type: 'person', position: { ...result.positions[p.id]! },
    data: { name: p.name || p.id, role: p.id === graph.personA ? 'A' : p.id === graph.personB ? 'B' : null, active: false },
  }))
  const edges: Edge[] = graph.relations.map((r, i) => {
    const presentation = typePresentation[r.type]
    const from = result.positions[r.from]!, to = result.positions[r.to]!
    const downward = to.y > from.y
    const sameLevel = to.y === from.y
    const rightward = to.x > from.x
    // Long horizontal links run above the row instead of through other people.
    const overRow = sameLevel && Math.abs(to.x - from.x) > compactNode.width * 2
    const sourceHandle = overRow ? 'top-source' : downward ? 'bottom' : rightward ? 'right' : 'left-source'
    const targetHandle = overRow ? 'top' : downward ? 'top' : rightward ? 'left' : 'right-target'
    return { id: `relation-${i}`, source: r.from, target: r.to, type: 'smoothstep', label: presentation.short,
      sourceHandle: downward && r.type === RelationType.SPIRITUAL ? 'spiritual-source' : downward && r.type === RelationType.ADOPTION ? 'adoption-source' : sourceHandle,
      targetHandle: downward && r.type === RelationType.SPIRITUAL ? 'spiritual-target' : downward && r.type === RelationType.ADOPTION ? 'adoption-target' : targetHandle,
      pathOptions: { offset: overRow ? 24 : 12, borderRadius: 6 },
      style: { stroke: presentation.color, strokeWidth: 2, strokeDasharray: presentation.dash },
      labelStyle: { fill: presentation.color, fontSize: '11px' },
      markerEnd: r.type === RelationType.MARRIAGE ? undefined : { type: MarkerType.ArrowClosed, color: presentation.color } }
  })
  return { ...result, nodes, edges }
}
