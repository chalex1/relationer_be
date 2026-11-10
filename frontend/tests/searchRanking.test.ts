import { expect, it } from 'vitest'
import type { ReferenceMatchDto } from '../src/api/generated/models/ReferenceMatchDto'
import type { CatalogSourceDto } from '../src/api/generated/models/CatalogSourceDto'
import { hasConfirmedConclusion, hasOpposingConclusions, matchKind, partitionMatches, rankMatches } from '../src/domain/searchRanking'

function source(confirmed = false, verdict: CatalogSourceDto['verdict'] = 'FORBIDDEN'): CatalogSourceDto {
  return { id: 'source', title: 'Тестовый источник', verdict, conclusion: 'Заключение', conclusionConfirmed: confirmed }
}
function match(id: string, changes: Partial<ReferenceMatchDto> = {}): ReferenceMatchDto {
  return { referenceId: id, verdict: 'FORBIDDEN', description: null, userPathCode: 'B>', referencePathCode: 'B>',
    source: { document: 'Источник', page: 1, example: null, conclusion: 'Исторический текст' }, reviewStatus: 'DRAFT', ...changes }
}

it('orders confirmed conclusions first, exact paths second and graph review third', () => {
  const entries = [
    match('unconfirmed-reviewed-exact', { reviewStatus: 'REVIEWED' }),
    match('confirmed-draft-partial', { sources: [source(true)], referencePathCode: '<BB>' }),
    match('confirmed-reviewed-partial', { sources: [source(true)], referencePathCode: '<BB>', reviewStatus: 'REVIEWED' }),
    match('confirmed-draft-exact', { sources: [source(true)] }),
    match('confirmed-reviewed-exact', { sources: [source(true)], reviewStatus: 'REVIEWED' }),
  ]
  expect(rankMatches(entries).map(r => r.match.referenceId)).toEqual([
    'confirmed-reviewed-exact', 'confirmed-draft-exact', 'confirmed-reviewed-partial', 'confirmed-draft-partial', 'unconfirmed-reviewed-exact',
  ])
})

it('never derives confirmation from historical verdict or REVIEWED', () => {
  for (const verdict of ['ALLOWED', 'FORBIDDEN', 'UNDETERMINED'] as const) {
    expect(hasConfirmedConclusion(match('case', { verdict, reviewStatus: 'REVIEWED', sources: [source(false, verdict)] }))).toBe(false)
  }
  expect(hasConfirmedConclusion(match('legacy'))).toBe(false)
  expect(hasConfirmedConclusion(match('no-text', { sources: [{ ...source(true), conclusion: '  ' }] }))).toBe(false)
  expect(hasConfirmedConclusion(match('confirmed-draft', { sources: [source(true)] }))).toBe(true)
})

it('changing verdict values cannot alter the rank', () => {
  const entries = [match('z'), match('a', { verdict: 'ALLOWED' }), match('b', { verdict: 'UNDETERMINED', sources: [source(true, 'ALLOWED')] })]
  const order = rankMatches(entries).map(r => r.match.referenceId)
  const changed = entries.map(e => ({ ...e, verdict: 'ALLOWED' as const, sources: e.sources?.map(s => ({ ...s, verdict: 'FORBIDDEN' as const })) }))
  expect(rankMatches(changed).map(r => r.match.referenceId)).toEqual(order)
})

it('uses token equality including reverse orientation, never a fabricated percentage or graph isomorphism', () => {
  expect(matchKind(match('exact', { userPathCode: '<U<GM<B', referencePathCode: 'B>MG>U>' }))).toBe('EXACT')
  expect(matchKind(match('partial', { userPathCode: 'B>', referencePathCode: '<BB>' }))).toBe('PARTIAL')
  expect(matchKind(match('longer', { userPathCode: '<BB>M', referencePathCode: '<BB>' }))).toBe('PARTIAL')
  expect(matchKind(match('different', { userPathCode: 'B>', referencePathCode: 'G>' }))).toBe('UNKNOWN')
  expect(matchKind(match('invalid', { userPathCode: 'B', referencePathCode: 'B' }))).toBe('UNKNOWN')
  expect(matchKind(match('empty', { userPathCode: '', referencePathCode: '' }))).toBe('UNKNOWN')
})

it('ranks graph review separately, preserving unknown status and marking correction cases last on equal evidence', () => {
  const entries = [match('needs', { reviewStatus: 'NEEDS_CORRECTION' }), match('unknown', { reviewStatus: undefined }),
    match('draft'), match('reviewed', { reviewStatus: 'REVIEWED' })]
  expect(rankMatches(entries).map(r => r.match.referenceId)).toEqual(['reviewed', 'draft', 'unknown', 'needs'])
})

it('splits at three and preserves every original occurrence without mutating the API array', () => {
  const duplicate = Object.freeze(match('duplicate'))
  const input = Object.freeze([match('z'), duplicate, match('a'), duplicate, match('b')])
  const result = partitionMatches(input)
  expect(result.primary).toHaveLength(3); expect(result.remaining).toHaveLength(2)
  const all = [...result.primary, ...result.remaining]
  expect(new Set(all.map(r => r.occurrence)).size).toBe(input.length)
  expect(all.filter(r => r.match === duplicate)).toHaveLength(2)
  expect(input.map(m => m.referenceId)).toEqual(['z', 'duplicate', 'a', 'duplicate', 'b'])
  for (let count = 0; count <= 3; count++) {
    const small = partitionMatches(input.slice(0, count))
    expect(small.primary).toHaveLength(count); expect(small.remaining).toHaveLength(0)
  }
})

it('warns when a hidden conclusion opposes a primary conclusion', () => {
  const result = partitionMatches([match('a'), match('b'), match('c'), match('d', { verdict: 'ALLOWED' })])
  expect(result.primaryConflict).toBe(false)
  expect(result.remainingConflict).toBe(true)
})

it('detects contradictions between hidden sources, including several sources of a single case', () => {
  const result = partitionMatches([
    match('a', { verdict: 'UNDETERMINED' }), match('b', { verdict: 'UNDETERMINED' }), match('c', { verdict: 'UNDETERMINED' }),
    match('d', { sources: [source(false, 'FORBIDDEN'), { ...source(false, 'ALLOWED'), id: 'other' }] }),
  ])
  expect(result.remainingConflict).toBe(true)
  expect(hasOpposingConclusions([result.remaining[0]!.match])).toBe(true)
})

it('does not call unknown conclusions contradictory and does not hide visible-only contradictions behind the toggle', () => {
  const result = partitionMatches([match('a', { verdict: 'FORBIDDEN' }), match('b', { verdict: 'ALLOWED' }),
    match('c', { verdict: 'UNDETERMINED' }), match('d', { verdict: 'UNDETERMINED' })])
  expect(result.primaryConflict).toBe(true)
  expect(result.remainingConflict).toBe(false)
})
