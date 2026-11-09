import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive } from 'vue'
import { createEditor, addRelative, connectPeople, movePerson, toSearchRequest } from '../src/domain/editor'
import { useReferenceSearch, validateSearchRequest } from '../src/composables/useReferenceSearch'
import type { SearchResponse } from '../src/api/generated/models/SearchResponse'
import type { SearchRequest } from '../src/api/generated/models/SearchRequest'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.splice(0).forEach(s => s.stop()); vi.unstubAllGlobals() })
function setup() {
  const editor = reactive(createEditor())
  const scope = effectScope(); scopes.push(scope)
  const search = scope.run(() => useReferenceSearch(computed(() => toSearchRequest(editor))))!
  return { editor, ...search }
}
const empty: SearchResponse = { matches: [] }
const found: SearchResponse = { matches: [{ referenceId: 'mock-case', verdict: 'FORBIDDEN', description: null,
  userPathCode: '<BB>', referencePathCode: '<BB>', source: { document: null, page: null, example: null, conclusion: null } }] }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

describe('reference search through generated API client', () => {
  it('sends the current graph and selected A/B without positions or internal relation IDs', async () => {
    const fetch = vi.fn().mockResolvedValue(json(found)); vi.stubGlobal('fetch', fetch)
    const { editor, search, state } = setup()
    const parent = addRelative(editor, 'person-a', 'parent', () => '1')
    connectPeople(editor, parent, 'person-b', 'child', () => '2')
    editor.graph.personA = parent; editor.graph.personB = 'person-b'
    await search()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/references/search')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(toSearchRequest(editor))
    expect(JSON.parse(init.body).persons).toHaveLength(3)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(state.value).toEqual({ status: 'success', response: found })
  })

  it('starts idle, exposes loading and preserves an empty successful response', async () => {
    const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const { state, search } = setup()
    expect(state.value).toEqual({ status: 'idle', stale: false })
    const task = search(); expect(state.value.status).toBe('loading')
    pending.resolve(json(empty)); await task
    expect(state.value).toEqual({ status: 'success', response: empty })
  })

  it.each([400, 500, 403])('shows a safe message for HTTP %s without server internals', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'internal stack trace' }, status)))
    const { state, search } = setup(); await search()
    expect(state.value.status).toBe('error')
    expect(state.value).not.toHaveProperty('response')
    expect(JSON.stringify(state.value)).not.toContain('internal stack trace')
    if (status === 400) expect(JSON.stringify(state.value)).toContain('Сервер отклонил граф')
    if (status === 500) expect(JSON.stringify(state.value)).toContain('временно недоступен')
  })

  it('shows network errors and permits retry, replacing the previous error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json(found)))
    const { state, search } = setup(); await search()
    expect(state.value).toEqual({ status: 'error', message: 'Не удалось связаться с сервисом поиска. Проверьте подключение и доступность backend.' })
    await search(); expect(state.value).toEqual({ status: 'success', response: found })
  })

  it('does not send invalid participant selections', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const { editor, state, search } = setup()
    editor.graph.personA = editor.graph.personB
    await search()
    expect(state.value).toEqual({ status: 'error', message: 'Выберите двух разных людей для A и B.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('discards successful results after graph changes, but preserves them on drag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(found)))
    const { editor, state, search } = setup(); await search()
    movePerson(editor, 'person-a', { x: 300, y: 200 })
    expect(state.value.status).toBe('success')
    addRelative(editor, 'person-a', 'parent', () => '1')
    expect(state.value).toEqual({ status: 'idle', stale: true })
  })

  it('invalidates results on rename and on either participant change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json(found))))
    const { editor, state, search } = setup()
    const parent = addRelative(editor, 'person-a', 'parent', () => '1')
    await search(); editor.graph.persons[0].name = 'Анна'
    expect(state.value).toEqual({ status: 'idle', stale: true })
    await search(); editor.graph.personA = parent
    expect(state.value).toEqual({ status: 'idle', stale: true })
    await search(); editor.graph.personB = 'person-a'
    expect(state.value).toEqual({ status: 'idle', stale: true })
  })

  it.each(['resolve', 'reject'] as const)('blocks double requests and ignores an obsolete %s after a newer response', async outcome => {
    const old = deferred<Response>()
    const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValueOnce(json(empty)); vi.stubGlobal('fetch', fetch)
    const { editor, state, search } = setup()
    const first = search(); await search()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const signal = fetch.mock.calls[0][1].signal as AbortSignal
    editor.graph.persons[0].name = 'Анна'
    expect(signal.aborted).toBe(true)
    expect(state.value).toEqual({ status: 'idle', stale: true })
    await search(); expect(state.value).toEqual({ status: 'success', response: empty })
    if (outcome === 'resolve') old.resolve(json(found)); else old.reject(new Error('old network failure'))
    await first
    expect(state.value).toEqual({ status: 'success', response: empty })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cancels on disposal and never publishes the response afterwards', async () => {
    const pending = deferred<Response>(); const fetch = vi.fn(() => pending.promise); vi.stubGlobal('fetch', fetch)
    const { state, search } = setup(); const task = search()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    scopes[0].stop()
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal!.aborted).toBe(true)
    pending.resolve(json(found)); await task
    expect(state.value.status).toBe('loading')
  })
})

describe('basic request validation', () => {
  it.each<[string, (r: SearchRequest) => void]>([
    ['missing A', r => { r.personA = '' }], ['missing B', r => { r.personB = '' }],
    ['unknown participant', r => { r.personA = 'missing' }],
    ['too few people', r => { r.persons.pop() }],
    ['duplicate ID', r => { r.persons[1].id = r.persons[0].id }],
    ['blank ID', r => { r.persons[0].id = ' ' }],
    ['unknown relation endpoint', r => { r.relations.push({ type: 'BIOLOGICAL', from: 'missing', to: r.personB }) }],
  ])('rejects %s', (_, mutate) => {
    const request = toSearchRequest(createEditor()); mutate(request)
    expect(validateSearchRequest(request)).toBeTypeOf('string')
  })
  it('accepts disconnected people and leaves matching to the backend', () => {
    expect(validateSearchRequest(toSearchRequest(createEditor()))).toBeNull()
  })
})
