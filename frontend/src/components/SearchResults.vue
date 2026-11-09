<script setup lang="ts">
import { computed } from 'vue'
import { VerdictDto } from '../api/generated/models/VerdictDto'
import type { SearchState } from '../composables/useReferenceSearch'
const props = defineProps<{ state: SearchState }>()
const verdicts = [
  { value: VerdictDto.FORBIDDEN, label: 'Запрещено', className: 'forbidden' },
  { value: VerdictDto.UNDETERMINED, label: 'Не определено', className: 'undetermined' },
  { value: VerdictDto.ALLOWED, label: 'Разрешено', className: 'allowed' },
]
const groups = computed(() => verdicts.map(verdict => ({ ...verdict,
  matches: props.state.status === 'success' ? props.state.response.matches.filter(m => m.verdict === verdict.value) : [],
})))
const contradictory = computed(() => groups.value[0].matches.length > 0 && groups.value[2].matches.length > 0)
</script>

<template>
  <section class="search-results" aria-label="Результаты поиска" :aria-busy="state.status === 'loading'">
    <p v-if="state.status === 'idle'" role="status">{{ state.stale ? 'Граф или участники изменены. Выполните поиск заново.' : 'Постройте граф, выберите A и B и найдите совпадения по справочнику.' }}</p>
    <p v-else-if="state.status === 'loading'" role="status">Ищем совпадения…</p>
    <p v-else-if="state.status === 'error'" class="search-error" role="alert">{{ state.message }}</p>
    <template v-else>
      <p v-if="!state.response.matches.length" role="status">Совпадений в справочнике не найдено. Это не означает разрешения.</p>
      <template v-else>
        <p role="status">Найдено совпадений: {{ state.response.matches.length }}. Каждый случай показан отдельно; общий вердикт не вычисляется.</p>
        <p v-if="contradictory" class="conflict-note">Справочник вернул и разрешённые, и запрещённые случаи. Рассмотрите основания каждого совпадения.</p>
        <section v-for="group in groups.filter(g => g.matches.length)" :key="group.value" class="verdict-group" :class="group.className" :aria-label="group.label">
          <h3>{{ group.label }} <span>({{ group.matches.length }})</span></h3>
          <article v-for="(match, index) in group.matches" :key="index" class="match-card">
            <div class="match-heading"><strong>{{ match.referenceId }}</strong><span class="verdict-badge">{{ group.label }}</span></div>
            <p v-if="match.description">{{ match.description }}</p>
            <dl class="path-codes"><div><dt>Ваш путь</dt><dd><code>{{ match.userPathCode }}</code></dd></div><div><dt>Путь в справочнике</dt><dd><code>{{ match.referencePathCode }}</code></dd></div></dl>
            <div v-if="match.source.document || match.source.page != null || match.source.example || match.source.conclusion" class="match-source">
              <p v-if="match.source.document || match.source.page != null"><strong>Источник:</strong> {{ match.source.document }}<span v-if="match.source.page != null"> · стр. {{ match.source.page }}</span></p>
              <p v-if="match.source.example">{{ match.source.example }}</p>
              <p v-if="match.source.conclusion">{{ match.source.conclusion }}</p>
            </div>
          </article>
        </section>
      </template>
    </template>
  </section>
</template>
