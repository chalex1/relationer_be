<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { ReferenceDetailDto } from '../api/generated/models/ReferenceDetailDto'
import ReferenceGraph from './ReferenceGraph.vue'
import { categoryLabels, verdictLabels } from '../domain/catalogLabels'
import { reviewLabels } from '../domain/review'
import type { ReviewStatus } from '../domain/review'
const props = defineProps<{ reference: ReferenceDetailDto; reviewStatus?: ReviewStatus }>()
const selectedSource = ref('')
const source = computed(() => {
  const item = props.reference.metadata.sources?.find(s => s.id === selectedSource.value) ?? props.reference.metadata.sources?.[0]
  return item ? { document: item.title, page: item.page, example: item.example, conclusion: item.conclusion, image: item.image } : props.reference.metadata.source
})
const imageFailed = ref(false)
const imageDialog = ref<HTMLDialogElement>()
watch(() => source.value.image, () => {
  imageFailed.value = false
  imageDialog.value?.close()
})
onBeforeUnmount(() => imageDialog.value?.close())
</script>
<template>
  <article class="reference-card" :aria-label="reference.metadata.id">
    <header><div><h2>{{ reference.metadata.title || reference.metadata.id }}</h2><span>{{ reference.metadata.id }}</span></div><span class="verdict-badge catalog-verdict" :class="reference.metadata.verdict.toLowerCase()">{{ verdictLabels[reference.metadata.verdict] }}</span></header>
    <p class="muted">Вердикт исторического источника. {{ reviewLabels[reviewStatus || reference.metadata.reviewStatus || 'DRAFT'] }}; это не подтверждает вывод источника.</p>
    <div class="reference-badges"><span v-for="category in reference.metadata.categories" :key="category">{{ categoryLabels[category] }}</span><span v-if="!reference.metadata.categories.size">Требует ручной классификации</span><span v-for="tag in reference.metadata.tags" :key="tag">#{{ tag }}</span></div>
    <p>{{ reference.metadata.description || 'Описание не указано.' }}</p>
    <slot />
    <div class="reference-visuals" :class="{ 'has-image': !!source.image }">
      <section class="reference-graph-panel" aria-label="Граф Relationer">
        <h3>Граф Relationer</h3>
        <ReferenceGraph :id="reference.metadata.id" :graph="reference.graph" />
      </section>
      <section class="reference-image-panel" aria-label="Оригинал из PDF">
        <h3>Оригинал из PDF</h3>
        <label v-if="(reference.metadata.sources?.length ?? 0) > 1">Источник схемы
          <select :value="selectedSource || reference.metadata.sources?.[0]?.id" @change="selectedSource = ($event.target as HTMLSelectElement).value"><option v-for="s in reference.metadata.sources" :key="s.id" :value="s.id">{{ s.title }} · стр. {{ s.page }}</option></select>
        </label>
        <figure v-if="source.image && !imageFailed">
          <button class="reference-image-button" :aria-label="`Увеличить оригинал: ${reference.metadata.id}`" @click="imageDialog?.showModal()">
            <img :src="source.image" :alt="`Схема из PDF: ${reference.metadata.id}`" loading="lazy" @error="imageFailed = true" />
          </button>
          <figcaption>Нажмите на изображение, чтобы увеличить.</figcaption>
        </figure>
        <p v-else class="missing-image" role="status">{{ imageFailed ? 'Изображение источника недоступно.' : 'Изображение из PDF пока не добавлено.' }}</p>
      </section>
    </div>
    <dialog ref="imageDialog" class="reference-image-dialog" :aria-label="`Оригинал из PDF: ${reference.metadata.id}`">
      <div class="reference-image-tools">
        <button class="button secondary" @click="imageDialog?.close()">Закрыть изображение</button>
        <a v-if="source.image" :href="source.image" target="_blank" rel="noopener">Открыть файл</a>
      </div>
      <img v-if="source.image && !imageFailed" :src="source.image" :alt="`Увеличенная схема: ${reference.metadata.id}`" loading="lazy" @error="imageFailed = true" />
      <p v-else>Не удалось открыть оригинал из PDF.</p>
    </dialog>
    <footer>
      <template v-if="reference.metadata.sources?.length">
        <section v-for="item in reference.metadata.sources" :key="item.id" class="catalog-source">
          <p>{{ item.title }}<template v-if="item.page"> · стр. {{ item.page }}</template><template v-if="item.example"> · {{ item.example }}</template></p>
          <p>Вердикт источника: {{ verdictLabels[item.verdict] }}</p><p v-if="item.conclusion">{{ item.conclusion }}</p>
        </section>
      </template>
      <template v-else><p>{{ source.document || 'Источник не указан' }}<template v-if="source.page"> · стр. {{ source.page }}</template><template v-if="source.example"> · {{ source.example }}</template></p><p v-if="source.conclusion">{{ source.conclusion }}</p></template>
    </footer>
  </article>
</template>
