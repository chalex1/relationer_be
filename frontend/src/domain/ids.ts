import type { EditorState } from './editor'

let nextSequence = 0

/**
 * Generates an ID that is unused by either people or relations in the graph.
 * The process-wide counter prevents reuse after deleting an object; checking
 * the graph also makes loading an existing graph with numeric IDs safe.
 */
export function createGraphId(state: Pick<EditorState, 'graph'>, prefix: string): string {
  const used = new Set([
    ...state.graph.persons.map(person => person.id),
    ...state.graph.relations.map(relation => relation.id),
  ])
  let id: string
  do {
    nextSequence += 1
    id = `${prefix}-${nextSequence}`
  } while (used.has(id))
  return id
}
