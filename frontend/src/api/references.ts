import { ReferencesApi } from './generated/apis/ReferencesApi'
import { Configuration } from './generated/runtime'
import type { SearchRequest } from './generated/models/SearchRequest'

// Empty basePath keeps /api on the current origin (Vite proxy in development).
const api = new ReferencesApi(new Configuration({
  basePath: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
}))

export function searchReferences(searchRequest: SearchRequest, signal: AbortSignal) {
  return api.searchReferences({ searchRequest }, { signal })
}

export function listReferences(signal: AbortSignal) {
  return api.listReferences({ signal })
}
export function getReference(id: string, signal: AbortSignal) {
  return api.getReference({ id }, { signal })
}
