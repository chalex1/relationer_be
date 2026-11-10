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
const entries = ref<ReferenceSummaryDto[]>([])
const filters = reactive<CatalogFilters>({ query: '', categories: [], tags: [], verdict: '' })
const matches = computed(() => filterCatalog(entries.value, filters))
const tags = computed(() => [...new Set(entries.value.flatMap(e => [...e.tags]))].sort())
const cards = ref<ReferenceDetailDto[]>([])
const loading = ref(false), initializing = ref(true), error = ref('')
const sentinel = ref<HTMLElement>()
let revision = 0, controller = new AbortController(), observer: IntersectionObserver | undefined
let alive = true
const hasMore = computed(() => cards.value.length < matches.value.length)
async function loadMore() {
  if (loading.value || !hasMore.value || error.value) return
  loading.value = true
  const current = revision
  try {
    const batch = matches.value.slice(cards.value.length, cards.value.length + 10)
    const details = await Promise.all(batch.map(e => getReference(e.id, controller.signal)))
    if (current === revision && alive) cards.value.push(...details)
  } catch (e) {
    if (current === revision && alive && !controller.signal.aborted) error.value = 'Не удалось загрузить кейсы. Повторите попытку.'
  } finally {
    if (current === revision && alive) { loading.value = false; await nextTick(); observe() }
  }
}
function observe() {
  observer?.disconnect()
  if (sentinel.value && !error.value && !loading.value && hasMore.value) observer?.observe(sentinel.value)
}
async function initialize() {
  initializing.value = true; error.value = ''
  try { entries.value = await listReferences(controller.signal) }
  catch { if (alive && !controller.signal.aborted) error.value = 'Не удалось загрузить каталог. Повторите попытку.' }
  finally { if (alive) initializing.value = false }
  if (alive && !error.value) await loadMore()
}
function retry() { error.value = ''; void (entries.value.length ? loadMore() : initialize()) }
watch(filters, () => {
  revision++; controller.abort(); controller = new AbortController()
  cards.value = []; loading.value = false; error.value = ''
  window.scrollTo({ top: 0, behavior: 'instant' })
  if (!initializing.value) void loadMore()
}, { deep: true })
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
      <form class="catalog-filters" @submit.prevent>
        <label>Поиск по ID, описанию и источнику<input v-model="filters.query" :disabled="initializing" type="search" /></label>
        <fieldset><legend>Категории (любая из выбранных)</legend><label v-for="category in RelationCategory" :key="category"><input v-model="filters.categories" :disabled="initializing" type="checkbox" :value="category" />{{ categoryLabels[category] }}</label></fieldset>
        <label>Вердикт<select aria-label="Вердикт" v-model="filters.verdict" :disabled="initializing"><option value="">Все вердикты</option><option v-for="verdict in VerdictDto" :key="verdict" :value="verdict">{{ verdictLabels[verdict] }}</option></select></label>
        <fieldset v-if="tags.length"><legend>Теги (все выбранные)</legend><label v-for="tag in tags" :key="tag"><input v-model="filters.tags" type="checkbox" :value="tag" />{{ tag }}</label></fieldset>
      </form>
      <p v-if="!initializing" role="status">Найдено: {{ matches.length }} · Показано: {{ cards.length }}</p>
      <section class="reference-feed" aria-label="Эталонные кейсы"><ReferenceCard v-for="card in cards" :key="card.metadata.id" :reference="card" /></section>
      <p v-if="initializing || loading" role="status">Загрузка…</p>
      <div v-if="error" role="alert">{{ error }} <button class="button secondary" @click="retry">Повторить</button></div>
      <p v-if="!initializing && !loading && !error && !hasMore" role="status">{{ matches.length ? 'Конец списка.' : 'По заданным фильтрам ничего не найдено.' }}</p>
      <div ref="sentinel" class="feed-sentinel" aria-hidden="true"></div>
      <button v-if="hasMore && !error" class="button secondary" :disabled="loading" @click="loadMore">Загрузить ещё</button>
    </main>
  </div>
</template>
