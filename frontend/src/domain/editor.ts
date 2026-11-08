import { RelationType } from '../api/generated/models/RelationType'
import type { PersonDto } from '../api/generated/models/PersonDto'
import type { RelationDto } from '../api/generated/models/RelationDto'
import type { SearchRequest } from '../api/generated/models/SearchRequest'

export interface Point { x: number; y: number }
export type EditorRelation = RelationDto & { id: string }
export interface EditorGraph extends SearchRequest {
  persons: PersonDto[]
  relations: EditorRelation[]
}
export interface EditorState { graph: EditorGraph; positions: Record<string, Point> }

export const relativeActions = [
  { id: 'parent', label: 'Родителя', role: 'Родитель', name: 'Родитель', type: RelationType.BIOLOGICAL, relativeIsFrom: true, dx: 0, dy: -170, icon: '↑' },
  { id: 'child', label: 'Ребёнка', role: 'Ребёнок', name: 'Ребёнок', type: RelationType.BIOLOGICAL, relativeIsFrom: false, dx: 0, dy: 170, icon: '↓' },
  { id: 'spouse', label: 'Супруга / супругу', role: 'Супруг / супруга', name: 'Супруг / супруга', type: RelationType.MARRIAGE, relativeIsFrom: false, dx: 270, dy: 0, icon: '↔' },
  { id: 'godparent', label: 'Крёстного', role: 'Крёстный', name: 'Крёстный', type: RelationType.SPIRITUAL, relativeIsFrom: true, dx: -250, dy: -170, icon: '↗' },
  { id: 'godchild', label: 'Крестника', role: 'Крестник', name: 'Крестник', type: RelationType.SPIRITUAL, relativeIsFrom: false, dx: -250, dy: 170, icon: '↘' },
  { id: 'adoptive-parent', label: 'Приёмного родителя', role: 'Приёмный родитель', name: 'Приёмный родитель', type: RelationType.ADOPTION, relativeIsFrom: true, dx: 250, dy: -170, icon: '↑' },
  { id: 'adopted-child', label: 'Приёмного ребёнка', role: 'Приёмный ребёнок', name: 'Приёмный ребёнок', type: RelationType.ADOPTION, relativeIsFrom: false, dx: 250, dy: 170, icon: '↓' },
] as const
export type RelativeAction = typeof relativeActions[number]['id']
const uuid = (): string => crypto.randomUUID()

export function createEditor(): EditorState {
  return {
    graph: {
      persons: [{ id: 'person-a', name: 'Персона A' }, { id: 'person-b', name: 'Персона B' }],
      relations: [], personA: 'person-a', personB: 'person-b',
    },
    positions: { 'person-a': { x: 80, y: 160 }, 'person-b': { x: 480, y: 160 } },
  }
}
function person(state: EditorState, id: string): PersonDto {
  const result = state.graph.persons.find(p => p.id === id)
  if (!result) throw new Error('Человек не найден в графе.')
  return result
}
export function actionDetails(action: RelativeAction) {
  const result = relativeActions.find(a => a.id === action)
  if (!result) throw new Error('Неизвестный вид отношения.')
  return result
}
export function relationFor(anchor: string, relative: string, action: RelativeAction): RelationDto {
  const details = actionDetails(action)
  return { type: details.type, from: details.relativeIsFrom ? relative : anchor, to: details.relativeIsFrom ? anchor : relative }
}
export function connectPeople(state: EditorState, anchor: string, relative: string, action: RelativeAction, idFactory = uuid): EditorRelation {
  person(state, anchor); person(state, relative)
  if (anchor === relative) throw new Error('Выберите другого человека.')
  const relation = relationFor(anchor, relative, action)
  const duplicate = state.graph.relations.some(r => r.type === relation.type && (
    (r.from === relation.from && r.to === relation.to) ||
    (r.type === RelationType.MARRIAGE && r.from === relation.to && r.to === relation.from)
  ))
  if (duplicate) throw new Error('Такая связь уже есть в графе.')
  const id = `relation-${idFactory()}`
  if (state.graph.relations.some(r => r.id === id)) throw new Error('Не удалось создать уникальную связь. Попробуйте ещё раз.')
  const result = { ...relation, id }
  state.graph.relations.push(result)
  return result
}
export function addRelative(state: EditorState, anchor: string, action: RelativeAction, idFactory = uuid): string {
  person(state, anchor)
  const details = actionDetails(action)
  const id = `person-${idFactory()}`
  if (state.graph.persons.some(p => p.id === id)) throw new Error('Не удалось создать уникальный ID. Попробуйте ещё раз.')
  const base = state.positions[anchor] ?? { x: 0, y: 0 }
  const position = { x: base.x + details.dx, y: base.y + details.dy }
  while (Object.values(state.positions).some(p => Math.abs(p.x - position.x) < 220 && Math.abs(p.y - position.y) < 110)) position.x += 240
  state.graph.persons.push({ id, name: details.name })
  try { connectPeople(state, anchor, id, action, idFactory) }
  catch (error) { state.graph.persons.pop(); throw error }
  state.positions[id] = position
  return id
}
export function renamePerson(state: EditorState, id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Введите имя или обозначение человека.')
  person(state, id).name = trimmed
}
export function isProtected(state: EditorState, id: string): boolean { return id === state.graph.personA || id === state.graph.personB }
export function personRelations(state: EditorState, id: string): EditorRelation[] { return state.graph.relations.filter(r => r.from === id || r.to === id) }
export function removePerson(state: EditorState, id: string): void {
  person(state, id)
  if (isProtected(state, id)) throw new Error('Персоны A и B нужны для построения графа. Их нельзя удалить.')
  state.graph.persons = state.graph.persons.filter(p => p.id !== id)
  state.graph.relations = state.graph.relations.filter(r => r.from !== id && r.to !== id)
  delete state.positions[id]
}
export function removeRelation(state: EditorState, id: string): void { state.graph.relations = state.graph.relations.filter(r => r.id !== id) }
export function movePerson(state: EditorState, id: string, position: Point): void {
  person(state, id)
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Некорректные координаты.')
  state.positions[id] = { ...position }
}
export function resetEditor(state: EditorState): void { Object.assign(state, createEditor()) }
export function toSearchRequest(state: EditorState): SearchRequest {
  return {
    persons: state.graph.persons.map(({ id, name }) => ({ id, name })),
    relations: state.graph.relations.map(({ type, from, to }) => ({ type, from, to })),
    personA: state.graph.personA, personB: state.graph.personB,
  }
}
