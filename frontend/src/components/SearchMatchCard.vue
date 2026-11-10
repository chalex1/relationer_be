<script setup lang="ts">
import { computed } from 'vue'
import type { RankedMatch } from '../domain/searchRanking'
import { matchKindLabels } from '../domain/searchRanking'
import { verdictLabels } from '../domain/catalogLabels'
import { reviewLabels } from '../domain/review'
const props = defineProps<{ entry: RankedMatch }>()
const match = computed(() => props.entry.match)
</script>
<template>
  <article class="match-card" :class="match.verdict.toLowerCase()" :aria-label="match.referenceId">
    <div class="match-heading"><strong>{{ match.referenceId }}</strong><span class="verdict-badge" title="Исторический вердикт первого источника">{{ verdictLabels[match.verdict] }}</span></div>
    <p v-if="match.title"><strong>{{ match.title }}</strong></p>
    <ul class="match-evidence" aria-label="Основания ранжирования">
      <li>{{ matchKindLabels[entry.kind] }}</li>
      <li>{{ match.reviewStatus ? reviewLabels[match.reviewStatus] : 'Статус проверки графа не указан' }}</li>
      <li :class="{ 'confirmed-conclusion': entry.conclusionConfirmed }">{{ entry.conclusionConfirmed ? 'Есть подтверждённое заключение' : 'Заключение не подтверждено' }}</li>
    </ul>
    <p v-if="match.reviewStatus === 'NEEDS_CORRECTION'" class="conflict-note">В графе найдена ошибка; совпадение требует проверки.</p>
    <p v-if="match.description">{{ match.description }}</p>
    <dl class="path-codes"><div><dt>Ваш путь</dt><dd><code>{{ match.userPathCode }}</code></dd></div><div><dt>Путь в справочнике</dt><dd><code>{{ match.referencePathCode }}</code></dd></div></dl>
    <div v-if="match.sources?.length" class="match-source">
      <section v-for="source in match.sources" :key="source.id">
        <p>{{ source.title }}<template v-if="source.page != null"> · стр. {{ source.page }}</template> · Вердикт источника: {{ verdictLabels[source.verdict] }}</p>
        <p v-if="source.example">{{ source.example }}</p>
        <p v-if="source.conclusion">{{ source.conclusion }}</p>
        <p :class="{ 'confirmed-conclusion': source.conclusionConfirmed && !!source.conclusion?.trim() }">{{ source.conclusionConfirmed && source.conclusion?.trim() ? 'Заключение подтверждено отдельно от проверки графа.' : 'Заключение этого источника не подтверждено.' }}</p>
      </section>
    </div>
    <div v-else-if="match.source.document || match.source.page != null || match.source.example || match.source.conclusion" class="match-source">
      <p v-if="match.source.document || match.source.page != null"><strong>Источник:</strong> {{ match.source.document }}<span v-if="match.source.page != null"> · стр. {{ match.source.page }}</span></p>
      <p v-if="match.source.example">{{ match.source.example }}</p>
      <p v-if="match.source.conclusion">{{ match.source.conclusion }}</p>
    </div>
  </article>
</template>
