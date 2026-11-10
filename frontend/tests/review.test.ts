import { catalogFixture } from './catalogFixture'
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ReferenceDetailDtoFromJSON } from '../src/api/generated/models/ReferenceDetailDto'
import { caseFingerprint, parseReviews, reviewFor, serializeReviews } from '../src/domain/review'
import type { ReviewResult } from '../src/domain/review'

const raw = catalogFixture()[0]
const detail = () => ReferenceDetailDtoFromJSON({ metadata: { ...raw, hasImage: true }, graph: raw })
const fingerprint = `sha256-v2:${'a'.repeat(64)}`
const record: ReviewResult = { id: raw.id, fingerprint, status: 'REVIEWED', comment: '', reviewedAt: '2026-11-10T20:00:00.000Z' }

it('fingerprint is stable across object, person, relation and set ordering', async () => {
  const first = detail(), second = detail()
  second.graph.persons.reverse(); second.graph.relations.reverse()
  second.metadata.source = Object.fromEntries(Object.entries(second.metadata.source).reverse()) as typeof second.metadata.source
  second.metadata.hasImage = false
  expect(await caseFingerprint(second)).toBe(await caseFingerprint(first))
})

it('changes to graph participants verdict source and descriptions invalidate approval', async () => {
  const original = await caseFingerprint(detail())
  for (const mutate of [
    (d: ReturnType<typeof detail>) => { d.graph.personA = 'p' },
    (d: ReturnType<typeof detail>) => { d.graph.persons[0]!.name = 'Новое имя' },
    (d: ReturnType<typeof detail>) => { d.graph.relations.pop() },
    (d: ReturnType<typeof detail>) => { d.metadata.verdict = 'ALLOWED' },
    (d: ReturnType<typeof detail>) => { d.metadata.source.image = '/new.png' },
    (d: ReturnType<typeof detail>) => { d.metadata.source.page = 99 },
    (d: ReturnType<typeof detail>) => { d.metadata.description = 'Новое описание' },
    (d: ReturnType<typeof detail>) => { d.metadata.tags.add('проверка') },
  ]) {
    const changed = detail(); mutate(changed)
    const hash = await caseFingerprint(changed)
    expect(hash).not.toBe(original)
    expect(reviewFor(raw.id, hash, { [raw.id]: { ...record, fingerprint: original } })).toMatchObject({ status: 'DRAFT', changed: true, reviewedAt: null })
  }
})

it('round trips results and keeps old fingerprints for re-review after import', () => {
  const records = { [raw.id]: record }
  const imported = parseReviews(serializeReviews(records))
  expect(imported).toEqual(records)
  expect(reviewFor(raw.id, fingerprint, imported)).toMatchObject({ status: 'REVIEWED', changed: false })
  expect(reviewFor(raw.id, `sha256-v2:${'b'.repeat(64)}`, imported)).toMatchObject({ status: 'DRAFT', changed: true })
  expect(reviewFor('toString', fingerprint, {})).toMatchObject({ status: 'DRAFT', changed: false })
})

it('migrates old approval names without approving the current fingerprint', () => {
  const old = parseReviews(JSON.stringify({ version: 1, results: [{ ...record, status: 'APPROVED', fingerprint: `sha256-v1:${'a'.repeat(64)}` }] }))
  expect(old[raw.id]!.status).toBe('REVIEWED')
  expect(reviewFor(raw.id, fingerprint, old)).toMatchObject({ status: 'DRAFT', changed: true })
})

it('rejects invalid files atomically including duplicate IDs and missing fingerprints or dates', () => {
  for (const value of [null, {}, { version: 2, results: [] }, { version: 1, results: [record, record] },
    ...[{ status: 'FORBIDDEN' }, { reviewedAt: null }, { reviewedAt: 'bad' }, { fingerprint: '' }, { comment: 42 }].map(change => ({ version: 1, results: [record, { ...record, id: 'other', ...change }] }))]) {
    expect(() => parseReviews(JSON.stringify(value))).toThrow()
  }
})
