<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { listReferences, getReference } from '../api/references'
import type { ReferenceSummaryDto } from '../api/generated/models/ReferenceSummaryDto'
import type { ReferenceDetailDto } from '../api/generated/models/ReferenceDetailDto'
import { RelationCategory } from '../api/generated/models/RelationCategory'
import { VerdictDto } from '../api/generated/models/VerdictDto'
import ReferenceCard from '../components/ReferenceCard.vue'
import { filterCatalog } from '../domain/catalog'
import type { CatalogFilters } from '../domain/catalog'
import { categoryLabels, verdictLabels } from '../domain/catalogLabels'
import DraftReview from '../components/DraftReview.vue'
import { useDraftReviews } from '../composables/useDraftReviews'
import { caseFingerprint, reviewFor, reviewLabels } from '../domain/review'
import type { ReviewStatus } from '../domain/review'
const mode = ref<'production' | 'drafts'>('production')
const entries = ref<ReferenceSummaryDto[]>([])
const drafts = ref<ReferenceDetailDto[]>([])
const fingerprints = ref<Record<string, string>>(Object.create(null))
const reviews = useDraftReviews()
const reviewStatus = ref<ReviewStatus | ''>('')
const filters = reactive<CatalogFilters>({ query: '', categories: [], tags: [], verdict: '' })
function review(id: string) { return reviewFor(id, fingerprints.value[id]!, reviews.results.value, entries.value.find(e => e.id === id)?.reviewStatus ?? 'DRAFT') }
const sort = ref('')
const matches = computed(() => filterCatalog(entries.value, filters).filter(entry =>
  mode.value !== 'drafts' || !reviewStatus.value || review(entry.id).status === reviewStatus.value).sort((a, b) => {
    if (!sort.value) return 0
    const field = sort.value.replace('-', '')
    const left = field === 'title' ? a.title ?? a.id : field === 'page' ? a.source.page ?? Number.MAX_SAFE_INTEGER : a.id
    const right = field === 'title' ? b.title ?? b.id : field === 'page' ? b.source.page ?? Number.MAX_SAFE_INTEGER : b.id
    const order = left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    return sort.value.startsWith('-') ? -order : order
  }))
const counts = computed(() => {
  const result = { DRAFT: 0, REVIEWED: 0, NEEDS_CORRECTION: 0, changed: 0 }
  for (const item of drafts.value) {
    const state = review(item.metadata.id)
    result[state.status]++
    if (state.changed) result.changed++
  }
  return result
})
const tags = computed(() => [...new Set(entries.value.flatMap(e => [...e.tags]))].sort())
const cards = ref<ReferenceDetailDto[]>([])
const loading = ref(false), initializing = ref(true), error = ref('')
const sentinel = ref<HTMLElement>()
let revision = 0, controller = new AbortController(), observer: IntersectionObserver | undefined
let alive = true
const hasMore = computed(() => cards.value.length < matches.value.length)
async function loadMore() {
  if (initializing.value || loading.value || !hasMore.value || error.value) return
  loading.value = true
  const current = revision, signal = controller.signal
  try {
    const batch = matches.value.slice(cards.value.length, cards.value.length + 10)
    const byId = new Map(drafts.value.map(d => [d.metadata.id, d]))
    const details = mode.value === 'drafts' ? batch.map(e => byId.get(e.id)!) :
      await Promise.all(batch.map(e => getReference(e.id, signal)))
    if (current === revision && alive) cards.value.push(...details)
  } catch {
    if (current === revision && alive && !signal.aborted) error.value = 'Не удалось загрузить кейсы. Повторите попытку.'
  } finally {
    if (current === revision && alive) { loading.value = false; await nextTick(); observe() }
  }
}
function observe() {
  observer?.disconnect()
  if (sentinel.value && !error.value && !loading.value && hasMore.value) observer?.observe(sentinel.value)
}
function reset() {
  revision++; controller.abort(); controller = new AbortController(); observer?.disconnect()
  cards.value = []; loading.value = false; error.value = ''
}
async function initialize() {
  reset(); entries.value = []; drafts.value = []; initializing.value = true
  const current = revision, signal = controller.signal, selected = mode.value
  try {
    const items = await listReferences(signal, selected === 'drafts' ? 'draft' : 'production')
    if (current !== revision || !alive) return
    if (selected === 'drafts') {
      const details = await Promise.all(items.map(e => getReference(e.id, signal)))
      const hashes = await Promise.all(details.map(async item => [item.metadata.id, await caseFingerprint(item)] as const))
      if (current !== revision || !alive) return
      fingerprints.value = Object.fromEntries(hashes)
      drafts.value = details
    }
    entries.value = items
  } catch {
    if (current === revision && alive && !signal.aborted) error.value = selected === 'drafts'
      ? 'Не удалось загрузить черновой каталог. Переключитесь на рабочий каталог или повторите попытку.'
      : 'Не удалось загрузить каталог. Повторите попытку.'
  } finally {
    if (current === revision && alive) initializing.value = false
  }
  if (current === revision && alive && !error.value) await loadMore()
}
function retry() { error.value = ''; void (entries.value.length ? loadMore() : initialize()) }
watch(mode, () => { window.scrollTo({ top: 0, behavior: 'instant' }); void initialize() })
// Only reset for actual changes in the filtered IDs; typing a comment keeps the card and focus.
watch(() => JSON.stringify([filters, sort.value, reviewStatus.value, matches.value.map(e => e.id)]), () => {
  if (initializing.value) return
  reset(); window.scrollTo({ top: 0, behavior: 'instant' }); void loadMore()
})
function exportResults() {
  reviews.exportResults(drafts.value.map(d => ({ id: d.metadata.id, fingerprint: fingerprints.value[d.metadata.id]! })))
}
async function importResults(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (file) await reviews.importResults(file)
  input.value = ''
}
onMounted(() => {
  observer = new IntersectionObserver(items => { if (items.some(i => i.isIntersecting)) void loadMore() }, { rootMargin: '500px' })
  void initialize()
})
onBeforeUnmount(() => { alive = false; controller.abort(); observer?.disconnect() })
</script>
<template>
  <div class="catalog-shell">
    <header class="app-header"><a class="brand" href="/"><img src="/favicon.svg" alt="" />relationer<span>.</span></a><a href="/">Конструктор родства</a><a href="/references" aria-current="page">Каталог эталонов</a></header>
    <main>
      <h1>Каталог эталонов</h1><p>Графы родства и заключения исторических источников. Участники каждой пары отмечены A и B.</p>
      <fieldset class="catalog-mode"><legend>Каталог</legend>
        <label><input v-model="mode" type="radio" value="production" />Рабочие</label>
        <label><input v-model="mode" type="radio" value="drafts" />На проверке</label>
      </fieldset>
      <section v-if="mode === 'drafts'" class="review-toolbar" aria-label="Ревью черновиков">
        <p>Отметки хранятся в этом браузере. Черновики участвуют в поиске. Проверка графа не подтверждает вердикт источника.</p>
        <p v-if="!initializing && !error" class="review-counts">Всего: {{ drafts.length }} · Ещё не проверены: {{ counts.DRAFT }} · Одобрены: {{ counts.REVIEWED }} · Отклонены: {{ counts.NEEDS_CORRECTION }} · Изменены: {{ counts.changed }}</p>
        <label>Статус проверки (фильтр)<select v-model="reviewStatus"><option value="">Все статусы</option><option v-for="(label, status) in reviewLabels" :key="status" :value="status">{{ label }}</option></select></label>
        <button class="button secondary" :disabled="initializing || !!error" @click="exportResults">Экспорт результатов</button>
        <label class="review-import">Импорт результатов<input type="file" accept=".json,application/json" @change="importResults" /></label>
        <p v-if="reviews.message.value" role="status">{{ reviews.message.value }}</p>
      </section>
      <form class="catalog-filters" @submit.prevent>
        <label>Сортировка<select v-model="sort"><option value="">Порядок каталога</option><option value="id">ID</option><option value="title">Название</option><option value="page">Страница источника</option><option value="-page">Страница по убыванию</option></select></label>
        <label>Поиск по ID, названию, описанию и источникам<input v-model="filters.query" :disabled="initializing" type="search" /></label>
        <fieldset><legend>Категории (любая из выбранных)</legend><label v-for="category in RelationCategory" :key="category"><input v-model="filters.categories" :disabled="initializing" type="checkbox" :value="category" />{{ categoryLabels[category] }}</label></fieldset>
        <label>Вердикт<select aria-label="Вердикт" v-model="filters.verdict" :disabled="initializing"><option value="">Все вердикты</option><option v-for="verdict in VerdictDto" :key="verdict" :value="verdict">{{ verdictLabels[verdict] }}</option></select></label>
        <fieldset v-if="tags.length"><legend>Теги (все выбранные)</legend><label v-for="tag in tags" :key="tag"><input v-model="filters.tags" type="checkbox" :value="tag" />{{ tag }}</label></fieldset>
      </form>
      <p v-if="!initializing" role="status">Найдено: {{ matches.length }} · Показано: {{ cards.length }}</p>
      <section class="reference-feed" aria-label="Эталонные кейсы">
        <ReferenceCard v-for="card in cards" :key="`${mode}:${card.metadata.id}`" :reference="card" :review-status="mode === 'drafts' ? review(card.metadata.id).status : undefined">
          <DraftReview v-if="mode === 'drafts'" :review="review(card.metadata.id)" @update="(status, comment) => reviews.update(card.metadata.id, fingerprints[card.metadata.id]!, status, comment)" />
        </ReferenceCard>
      </section>
      <p v-if="initializing || loading" role="status">Загрузка…</p>
      <div v-if="error" role="alert">{{ error }} <button class="button secondary" @click="retry">Повторить</button></div>
      <p v-if="!initializing && !loading && !error && !hasMore" role="status">{{ matches.length ? 'Конец списка.' : 'По заданным фильтрам ничего не найдено.' }}</p>
      <div ref="sentinel" class="feed-sentinel" aria-hidden="true"></div>
      <button v-if="hasMore && !error" class="button secondary" :disabled="loading" @click="loadMore">Загрузить ещё</button>
    </main>
  </div>
</template>
