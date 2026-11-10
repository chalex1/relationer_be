<script setup lang="ts">
import { ref } from 'vue'
import type { ReferenceDetailDto } from '../api/generated/models/ReferenceDetailDto'
import ReferenceGraph from './ReferenceGraph.vue'
import { categoryLabels, verdictLabels } from '../domain/catalogLabels'
defineProps<{ reference: ReferenceDetailDto }>()
const imageFailed = ref(false)
</script>
<template>
  <article class="reference-card" :aria-label="reference.metadata.id">
    <header><h2>{{ reference.metadata.id }}</h2><span class="verdict-badge catalog-verdict" :class="reference.metadata.verdict.toLowerCase()">{{ verdictLabels[reference.metadata.verdict] }}</span></header>
    <div class="reference-badges"><span v-for="category in reference.metadata.categories" :key="category">{{ categoryLabels[category] }}</span><span v-if="!reference.metadata.categories.size">Требует ручной классификации</span><span v-for="tag in reference.metadata.tags" :key="tag">#{{ tag }}</span></div>
    <p>{{ reference.metadata.description || 'Описание не указано.' }}</p>
    <div class="reference-visuals" :class="{ 'has-image': !!reference.metadata.source.image }">
      <ReferenceGraph :id="reference.metadata.id" :graph="reference.graph" />
      <figure v-if="reference.metadata.source.image && !imageFailed"><img :src="reference.metadata.source.image" :alt="`Схема из PDF: ${reference.metadata.id}`" loading="lazy" @error="imageFailed = true" /><figcaption>Исходная схема PDF</figcaption></figure>
      <p v-else class="missing-image">{{ imageFailed ? 'Изображение источника недоступно.' : 'Изображение из PDF пока не добавлено.' }}</p>
    </div>
    <footer><p>{{ reference.metadata.source.document || 'Источник не указан' }}<template v-if="reference.metadata.source.page"> · стр. {{ reference.metadata.source.page }}</template><template v-if="reference.metadata.source.example"> · {{ reference.metadata.source.example }}</template></p><p v-if="reference.metadata.source.conclusion">{{ reference.metadata.source.conclusion }}</p></footer>
  </article>
</template>
