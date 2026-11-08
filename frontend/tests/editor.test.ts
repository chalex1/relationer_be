import { describe, expect, it } from 'vitest'
import { RelationType } from '../src/api/generated/models/RelationType'
import { SearchRequestToJSON } from '../src/api/generated/models/SearchRequest'
import { createEditor, addRelative, connectPeople, movePerson, removePerson, removeRelation, renamePerson,
  resetEditor, toSearchRequest, personRelations } from '../src/domain/editor'
import type { RelativeAction } from '../src/domain/editor'

const ids = () => { let n = 0; return () => String(++n) }
describe('editor domain', () => {
  it('starts with stable unique A/B, names, coordinates and no relations', () => {
    const state = createEditor()
    expect(state.graph.persons).toEqual([{ id: state.graph.personA, name: 'Персона A' }, { id: state.graph.personB, name: 'Персона B' }])
    expect(state.graph.personA).not.toBe(state.graph.personB)
    expect(state.graph.relations).toEqual([])
    expect(createEditor()).toEqual(state)
    expect(state.positions[state.graph.personA]).not.toEqual(state.positions[state.graph.personB])
  })

  it.each<[RelativeAction, string, boolean]>([
    ['parent', 'BIOLOGICAL', true], ['child', 'BIOLOGICAL', false], ['spouse', 'MARRIAGE', false],
    ['godparent', 'SPIRITUAL', true], ['godchild', 'SPIRITUAL', false],
    ['adoptive-parent', 'ADOPTION', true], ['adopted-child', 'ADOPTION', false],
  ])('adds %s with the correct direction', (action, type, relativeIsFrom) => {
    const state = createEditor()
    const id = addRelative(state, state.graph.personA, action, ids())
    expect(state.graph.persons).toHaveLength(3)
    expect(state.graph.relations).toHaveLength(1)
    expect(state.graph.relations[0]).toMatchObject({ type, from: relativeIsFrom ? id : state.graph.personA, to: relativeIsFrom ? state.graph.personA : id })
    expect(state.positions[id]).toBeDefined()
    expect(state.positions[id]).not.toEqual(state.positions[state.graph.personA])
    if (action === 'parent' || action === 'godparent' || action === 'adoptive-parent') expect(state.positions[id].y).toBeLessThan(state.positions[state.graph.personA].y)
    if (action === 'child' || action === 'godchild' || action === 'adopted-child') expect(state.positions[id].y).toBeGreaterThan(state.positions[state.graph.personA].y)
  })

  it('connects B to the same parent as A without adding a duplicate person', () => {
    const state = createEditor(); const next = ids()
    const parent = addRelative(state, state.graph.personA, 'parent', next)
    connectPeople(state, parent, state.graph.personB, 'child', next)
    expect(state.graph.persons).toHaveLength(3)
    expect(state.graph.relations.map(({ from, to }) => [from, to])).toEqual([[parent, state.graph.personA], [parent, state.graph.personB]])
  })

  it('rejects identical and equivalent directed relations', () => {
    const state = createEditor(); const next = ids(); const a = state.graph.personA; const b = state.graph.personB
    connectPeople(state, a, b, 'parent', next)
    expect(() => connectPeople(state, a, b, 'parent', next)).toThrow('уже есть')
    expect(() => connectPeople(state, b, a, 'child', next)).toThrow('уже есть')
    expect(state.graph.relations).toHaveLength(1)
  })

  it('rejects duplicate marriages in either direction', () => {
    const state = createEditor(); const next = ids()
    connectPeople(state, state.graph.personA, state.graph.personB, 'spouse', next)
    expect(() => connectPeople(state, state.graph.personB, state.graph.personA, 'spouse', next)).toThrow('уже есть')
    expect(state.graph.relations).toHaveLength(1)
  })

  it('keeps distinct kinds of relations between the same people', () => {
    const state = createEditor(); const next = ids()
    connectPeople(state, state.graph.personA, state.graph.personB, 'child', next)
    connectPeople(state, state.graph.personA, state.graph.personB, 'godchild', next)
    expect(state.graph.relations.map(r => r.type)).toEqual([RelationType.BIOLOGICAL, RelationType.SPIRITUAL])
  })

  it('rejects missing participants and self connections without changes', () => {
    const state = createEditor(); const before = toSearchRequest(state)
    expect(() => connectPeople(state, 'missing', state.graph.personB, 'parent')).toThrow()
    expect(() => connectPeople(state, state.graph.personA, 'missing', 'parent')).toThrow()
    expect(() => connectPeople(state, state.graph.personA, state.graph.personA, 'parent')).toThrow()
    expect(() => addRelative(state, 'missing', 'child')).toThrow()
    expect(toSearchRequest(state)).toEqual(before)
  })

  it('places multiple new relatives without overlapping existing nodes', () => {
    const state = createEditor(); const next = ids()
    const first = addRelative(state, state.graph.personA, 'parent', next)
    const second = addRelative(state, state.graph.personA, 'parent', next)
    expect(first).not.toBe(second)
    expect(state.positions[first]).not.toEqual(state.positions[second])
  })

  it('removes a person with all their relations and preserves unrelated relations', () => {
    const state = createEditor(); const next = ids()
    const parent = addRelative(state, state.graph.personA, 'parent', next)
    connectPeople(state, parent, state.graph.personB, 'child', next)
    const unrelated = connectPeople(state, state.graph.personA, state.graph.personB, 'spouse', next)
    removePerson(state, parent)
    expect(state.graph.persons).toHaveLength(2)
    expect(state.graph.relations).toEqual([unrelated])
    expect(state.positions[parent]).toBeUndefined()
  })

  it('protects A and B from deletion', () => {
    const state = createEditor()
    expect(() => removePerson(state, state.graph.personA)).toThrow('нельзя удалить')
    expect(() => removePerson(state, state.graph.personB)).toThrow('нельзя удалить')
    expect(state.graph.persons).toHaveLength(2)
  })

  it('removes only the selected relation', () => {
    const state = createEditor(); const next = ids()
    const p = addRelative(state, state.graph.personA, 'parent', next)
    const relation = connectPeople(state, p, state.graph.personB, 'child', next)
    removeRelation(state, relation.id)
    expect(state.graph.persons).toHaveLength(3)
    expect(personRelations(state, p)).toHaveLength(1)
  })

  it('renames protected and ordinary people without changing ID or relations', () => {
    const state = createEditor(); const next = ids()
    const id = addRelative(state, state.graph.personA, 'parent', next)
    const before = structuredClone(state.graph.relations)
    renamePerson(state, state.graph.personA, ' Анна '); renamePerson(state, id, 'Елена')
    expect(state.graph.persons[0]).toEqual({ id: state.graph.personA, name: 'Анна' })
    expect(state.graph.relations).toEqual(before)
    expect(() => renamePerson(state, id, '  ')).toThrow('Введите имя')
  })

  it('resets persons relations names and coordinates while preserving the stable A/B IDs', () => {
    const state = createEditor(); addRelative(state, state.graph.personB, 'godparent', ids())
    renamePerson(state, state.graph.personA, 'Имя'); movePerson(state, state.graph.personB, { x: 999, y: -100 })
    resetEditor(state)
    expect(state).toEqual(createEditor())
  })

  it('exports generated SearchRequest without visual coordinates or internal relation IDs', () => {
    const state = createEditor(); const id = addRelative(state, state.graph.personA, 'parent', ids())
    const request = toSearchRequest(state)
    expect(request.relations).toEqual([{ type: RelationType.BIOLOGICAL, from: id, to: state.graph.personA }])
    expect(Object.keys(request).sort()).toEqual(['personA', 'personB', 'persons', 'relations'])
    expect(SearchRequestToJSON(request)).toEqual(request)
    expect(JSON.stringify(request)).not.toMatch(/positions|relation-\d/)
  })

  it('moving nodes changes only the coordinate store', () => {
    const state = createEditor(); addRelative(state, state.graph.personA, 'godparent', ids())
    const graph = structuredClone(state.graph); const request = toSearchRequest(state)
    movePerson(state, state.graph.personA, { x: -200, y: 1000 })
    expect(state.graph).toEqual(graph)
    expect(toSearchRequest(state)).toEqual(request)
    expect(() => movePerson(state, state.graph.personA, { x: NaN, y: 0 })).toThrow()
  })

  it('exported request does not share mutable arrays or persons with the editor', () => {
    const state = createEditor(); const request = toSearchRequest(state)
    request.persons[0].name = 'Другое имя'; request.persons.pop()
    expect(state.graph.persons).toHaveLength(2)
    expect(state.graph.persons[0].name).toBe('Персона A')
  })
})


describe('individual parents', () => {
  it('keeps two shared parents as separate people without inventing a marriage', () => {
    const state = createEditor(); const next = ids()
    const first = addRelative(state, state.graph.personA, 'parent', next)
    const second = addRelative(state, state.graph.personA, 'parent', next)
    connectPeople(state, first, state.graph.personB, 'child', next)
    connectPeople(state, second, state.graph.personB, 'child', next)
    const request = toSearchRequest(state)
    expect(request.persons).toEqual([
      ...createEditor().graph.persons,
      { id: first, name: 'Родитель' }, { id: second, name: 'Родитель' },
    ])
    expect(request.relations).toEqual([
      { type: 'BIOLOGICAL', from: first, to: 'person-a' },
      { type: 'BIOLOGICAL', from: second, to: 'person-a' },
      { type: 'BIOLOGICAL', from: first, to: 'person-b' },
      { type: 'BIOLOGICAL', from: second, to: 'person-b' },
    ])
    expect(SearchRequestToJSON(request)).toEqual(request)
  })

  it('preserves separate parents and marriage for children from different unions', () => {
    const state = createEditor(); const next = ids()
    const p = addRelative(state, state.graph.personA, 'parent', next)
    const q = addRelative(state, state.graph.personB, 'parent', next)
    connectPeople(state, p, q, 'spouse', next)
    const request = toSearchRequest(state)
    expect(request.relations).toEqual([
      { type: 'BIOLOGICAL', from: p, to: 'person-a' },
      { type: 'BIOLOGICAL', from: q, to: 'person-b' },
      { type: 'MARRIAGE', from: p, to: q },
    ])
    expect(request.persons).toEqual(state.graph.persons)
  })
})
