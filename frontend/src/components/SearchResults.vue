<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { SearchState } from '../composables/useReferenceSearch'
import { partitionMatches } from '../domain/searchRanking'
import SearchMatchCard from './SearchMatchCard.vue'
const props = defineProps<{ state: SearchState }>()
const expanded = ref(false)
const remainingId = useId()
const result = computed(() => partitionMatches(props.state.status === 'success' ? props.state.response.matches : []))
watch(() => props.state, () => { expanded.value = false })
</script>

<template>
  <section class="search-results" aria-label="Результаты поиска" :aria-busy="state.status === 'loading'">
    <p v-if="state.status === 'idle'" role="status">{{ state.stale ? 'Граф или участники изменены. Выполните поиск заново.' : 'Постройте граф, выберите A и B и найдите совпадения по справочнику.' }}</p>
    <p v-else-if="state.status === 'loading'" role="status">Ищем совпадения…</p>
    <p v-else-if="state.status === 'error'" class="search-error" role="alert">{{ state.message }}</p>
    <template v-else>
      <p v-if="state.response.catalogWarning" role="alert">{{ state.response.catalogWarning }}</p>
      <p v-if="!state.response.matches.length" role="status">Совпадений в справочнике не найдено. Это не означает разрешения.</p>
      <template v-else>
        <p role="status">Найдено совпадений: {{ state.response.matches.length }}. Показано: {{ expanded ? state.response.matches.length : result.primary.length }}. Общий вердикт не вычисляется.</p>
        <p class="muted">Показаны выводы исторических источников. Сначала подтверждённые заключения, затем точные совпадения пути и проверенные графы. Исторический вердикт не определяет достоверность.</p>
        <p class="muted">Точное совпадение пути не доказывает равенства полных графов. Проверка графа не подтверждает заключение источника.</p>
        <p v-if="!state.response.matches.some(m => m.sources?.some(s => s.conclusionConfirmed && s.conclusion?.trim()))" class="muted">Подтверждённых заключений среди совпадений пока нет. Ниже показаны наиболее подходящие варианты с явными отметками проверки.</p>
        <p v-if="result.primaryConflict" class="conflict-note">Справочник вернул и разрешённые, и запрещённые случаи. Рассмотрите основания каждого совпадения.</p>
        <div class="primary-matches" aria-label="Основные совпадения">
          <SearchMatchCard v-for="entry in result.primary" :key="entry.occurrence" :entry="entry" />
        </div>
        <div v-if="result.remaining.length" class="other-matches-controls">
          <button type="button" class="button secondary" :aria-expanded="expanded" :aria-controls="remainingId" @click="expanded = !expanded">{{ expanded ? 'Скрыть остальные варианты' : `Смотреть остальные варианты (${result.remaining.length})` }}</button>
          <p v-if="result.remainingConflict" class="conflict-note remaining-conflict" role="status">Среди остальных вариантов есть выводы источников, противоречащие показанным или друг другу.</p>
        </div>
        <div :id="remainingId" :hidden="!expanded" class="remaining-matches" aria-label="Остальные совпадения">
          <SearchMatchCard v-for="entry in expanded ? result.remaining : []" :key="entry.occurrence" :entry="entry" />
        </div>
      </template>
    </template>
  </section>
</template>
