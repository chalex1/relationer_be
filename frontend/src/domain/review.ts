import type { ReferenceDetailDto } from '../api/generated/models/ReferenceDetailDto'

export const reviewLabels = { DRAFT: 'Граф ещё не проверен', REVIEWED: 'Граф проверен человеком', NEEDS_CORRECTION: 'Найдена ошибка в графе' } as const
export type ReviewStatus = keyof typeof reviewLabels
export interface ReviewResult { id: string; fingerprint: string; status: ReviewStatus; comment: string; reviewedAt: string | null }
export type ReviewResults = Record<string, ReviewResult>
export const reviewStorageKey = 'relationer.reference-reviews.v1'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}

/** Versioned fingerprint of all persisted case fields; presentation-only hasImage is excluded. */
export async function caseFingerprint(detail: ReferenceDetailDto): Promise<string> {
  const { hasImage: _, ...metadata } = detail.metadata
  const content = { metadata: { ...metadata, categories: [...metadata.categories].sort(), tags: [...metadata.tags].sort() },
    graph: { ...detail.graph, persons: [...detail.graph.persons].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      relations: [...detail.graph.relations].sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0) } }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(content)))
  return `sha256-v2:${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}`
}

export function reviewFor(id: string, fingerprint: string, results: ReviewResults, baseline: ReviewStatus = 'DRAFT'): ReviewResult & { changed: boolean } {
  const previous = Object.hasOwn(results, id) ? results[id] : undefined
  const changed = !!previous && previous.fingerprint !== fingerprint
  if (previous && !changed) return { ...previous, changed: false }
  return { id, fingerprint, status: changed ? 'DRAFT' : baseline, comment: '', reviewedAt: null, changed }
}

export function serializeReviews(results: ReviewResults): string {
  return JSON.stringify({ version: 1, results: Object.values(results).sort((a, b) => a.id < b.id ? -1 : 1) }, null, 2)
}

/** Validate the entire file before applying anything. Unknown IDs remain bound to their fingerprints. */
export function parseReviews(text: string): ReviewResults {
  const data = JSON.parse(text)
  if (!data || data.version !== 1 || !Array.isArray(data.results)) throw new Error('Неверный формат результатов ревью.')
  const results: ReviewResults = Object.create(null)
  for (const item of data.results) {
    if (item && typeof item.status === 'string') {
      const legacy: Record<string, ReviewStatus> = { PENDING: 'DRAFT', APPROVED: 'REVIEWED', REJECTED: 'NEEDS_CORRECTION' }
      if (Object.hasOwn(legacy, item.status)) item.status = legacy[item.status]
    }
    if (!item || typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.fingerprint !== 'string' || !/^sha256-v[12]:[a-f0-9]{64}$/.test(item.fingerprint) ||
        !Object.hasOwn(reviewLabels, item.status) || typeof item.comment !== 'string' || item.comment.length > 5000 ||
        !(item.reviewedAt === null && item.status === 'DRAFT' || typeof item.reviewedAt === 'string' &&
          /^\d{4}-\d{2}-\d{2}T/.test(item.reviewedAt) && Number.isFinite(Date.parse(item.reviewedAt))) ||
        Object.hasOwn(results, item.id)) throw new Error('Некорректная запись или повтор ID в результатах ревью.')
    results[item.id] = { id: item.id, fingerprint: item.fingerprint, status: item.status, comment: item.comment, reviewedAt: item.reviewedAt }
  }
  return results
}
