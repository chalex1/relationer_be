import { onScopeDispose, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import type { SearchRequest } from '../api/generated/models/SearchRequest'
import type { SearchResponse } from '../api/generated/models/SearchResponse'
import { RelationType } from '../api/generated/models/RelationType'
import { ResponseError } from '../api/generated/runtime'
import { searchReferences } from '../api/references'

export type SearchState =
  | { status: 'idle'; stale: boolean }
  | { status: 'loading' }
  | { status: 'success'; response: SearchResponse }
  | { status: 'error'; message: string }

export function validateSearchRequest(request: SearchRequest): string | null {
  if (!request.personA || !request.personB) return 'Выберите участников A и B.'
  if (request.personA === request.personB) return 'Выберите двух разных людей для A и B.'
  const ids = new Set(request.persons.map(p => p.id))
  if (request.persons.length < 2 || ids.size !== request.persons.length || request.persons.some(p => !p.id.trim())) {
    return 'В графе должны быть хотя бы два человека с уникальными непустыми ID.'
  }
  if (!ids.has(request.personA) || !ids.has(request.personB)) return 'Участники A и B должны присутствовать в графе.'
  if (request.relations.some(r => !ids.has(r.from) || !ids.has(r.to) || !Object.values(RelationType).includes(r.type))) {
    return 'Проверьте связи: каждый участник связи должен присутствовать в графе, а тип связи должен быть известен.'
  }
  return null
}

function errorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    if (error.response.status === 400) return 'Сервер отклонил граф. Проверьте участников A/B и родственные связи, затем повторите поиск.'
    if (error.response.status >= 500) return 'Сервис поиска временно недоступен. Повторите попытку позже.'
    return 'Не удалось выполнить поиск. Проверьте доступ к сервису и повторите попытку.'
  }
  return 'Не удалось связаться с сервисом поиска. Проверьте подключение и доступность backend.'
}

export function useReferenceSearch(request: Readonly<Ref<SearchRequest>>, execute = searchReferences) {
  const state = shallowRef<SearchState>({ status: 'idle', stale: false })
  let revision = 0
  let controller: AbortController | undefined
  const invalidate = () => {
    revision++
    controller?.abort()
    controller = undefined
    state.value = { status: 'idle', stale: state.value.status !== 'idle' || state.value.stale }
  }
  // Coordinates and visual selection are deliberately absent from SearchRequest.
  watch(() => JSON.stringify(request.value), invalidate, { flush: 'sync' })
  onScopeDispose(() => { revision++; controller?.abort() })

  async function search() {
    if (state.value.status === 'loading') return
    const snapshot = structuredClone(request.value)
    const validationError = validateSearchRequest(snapshot)
    if (validationError) { state.value = { status: 'error', message: validationError }; return }
    const current = ++revision
    controller = new AbortController()
    state.value = { status: 'loading' }
    try {
      const response = await execute(snapshot, controller.signal)
      if (revision === current) state.value = { status: 'success', response }
    } catch (error) {
      if (revision === current) state.value = { status: 'error', message: errorMessage(error) }
    } finally {
      if (revision === current) controller = undefined
    }
  }
  return { state, search }
}
