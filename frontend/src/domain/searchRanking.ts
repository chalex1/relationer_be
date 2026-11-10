import type { ReferenceMatchDto } from '../api/generated/models/ReferenceMatchDto'

export type MatchKind = 'EXACT' | 'PARTIAL' | 'UNKNOWN'
export const matchKindLabels: Record<MatchKind, string> = {
  EXACT: 'Точное совпадение пути',
  PARTIAL: 'Частичное совпадение пути',
  UNKNOWN: 'Точность пути не определена',
}
export interface RankedMatch {
  match: ReferenceMatchDto
  occurrence: number
  kind: MatchKind
  conclusionConfirmed: boolean
}
const inverses: Record<string, string> = { 'B>': '<B', '<B': 'B>', 'G>': '<G', '<G': 'G>', 'U>': '<U', '<U': 'U>', M: 'M' }
function tokens(code: string): string[] | null {
  const result = code.match(/B>|<B|G>|<G|U>|<U|M/g)
  return result?.join('') === code ? result : null
}
function reverse(path: string[]) { return [...path].reverse().map(token => inverses[token]!) }
function contains(container: string[], fragment: string[]) {
  return container.some((_, i) => i + fragment.length <= container.length && fragment.every((token, j) => token === container[i + j]))
}

/** Path accuracy only: the API does not provide a proof of full graph equality. */
export function matchKind(match: ReferenceMatchDto): MatchKind {
  const user = tokens(match.userPathCode), reference = tokens(match.referencePathCode)
  if (!user || !reference) return 'UNKNOWN'
  const backward = reverse(reference)
  if (user.length === reference.length && (contains(user, reference) || contains(user, backward))) return 'EXACT'
  return contains(user, reference) || contains(user, backward) || contains(reference, user) || contains(backward, user) ? 'PARTIAL' : 'UNKNOWN'
}
export function hasConfirmedConclusion(match: ReferenceMatchDto): boolean {
  return !!match.sources?.some(source => source.conclusionConfirmed === true && !!source.conclusion?.trim())
}
const kindOrder: Record<MatchKind, number> = { EXACT: 0, PARTIAL: 1, UNKNOWN: 2 }
function graphOrder(match: ReferenceMatchDto): number {
  return match.reviewStatus === 'REVIEWED' ? 0 : match.reviewStatus === 'DRAFT' ? 1 : match.reviewStatus === 'NEEDS_CORRECTION' ? 3 : 2
}
function compareText(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0 }

/** Confirmed conclusion, exact path, graph review, stable textual ties. Verdict never affects order. */
export function rankMatches(matches: readonly ReferenceMatchDto[]): RankedMatch[] {
  return matches.map((match, occurrence) => ({ match, occurrence, kind: matchKind(match), conclusionConfirmed: hasConfirmedConclusion(match) }))
    .sort((a, b) => Number(b.conclusionConfirmed) - Number(a.conclusionConfirmed) ||
      kindOrder[a.kind] - kindOrder[b.kind] || graphOrder(a.match) - graphOrder(b.match) ||
      compareText(a.match.referenceId, b.match.referenceId) || compareText(a.match.userPathCode, b.match.userPathCode) ||
      compareText(a.match.referencePathCode, b.match.referencePathCode) || a.occurrence - b.occurrence)
}
function verdicts(matches: readonly ReferenceMatchDto[]) {
  return new Set(matches.flatMap(match => match.sources?.length ? match.sources.map(s => s.verdict) : [match.verdict]))
}
export function hasOpposingConclusions(matches: readonly ReferenceMatchDto[]): boolean {
  const values = verdicts(matches)
  return values.has('FORBIDDEN') && values.has('ALLOWED')
}
export function partitionMatches(matches: readonly ReferenceMatchDto[]) {
  const ranked = rankMatches(matches), primary = ranked.slice(0, 3), remaining = ranked.slice(3)
  const hiddenVerdicts = verdicts(remaining.map(r => r.match)), allVerdicts = verdicts(matches)
  const remainingConflict = hiddenVerdicts.has('FORBIDDEN') && allVerdicts.has('ALLOWED') || hiddenVerdicts.has('ALLOWED') && allVerdicts.has('FORBIDDEN')
  return { primary, remaining, remainingConflict, primaryConflict: hasOpposingConclusions(primary.map(r => r.match)) }
}
