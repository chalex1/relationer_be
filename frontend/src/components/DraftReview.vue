<script setup lang="ts">
import { reviewLabels } from '../domain/review'
import type { ReviewResult, ReviewStatus } from '../domain/review'
defineProps<{ review: ReviewResult & { changed: boolean } }>()
const emit = defineEmits<{ update: [status: ReviewStatus, comment: string] }>()
</script>
<template>
  <div class="draft-review">
    <p v-if="review.changed" class="review-changed" role="status">Содержимое кейса изменилось. Требует повторной проверки.</p>
    <label>Статус проверки
      <select :value="review.status" @change="emit('update', ($event.target as HTMLSelectElement).value as ReviewStatus, review.comment)">
        <option v-for="(label, status) in reviewLabels" :key="status" :value="status">{{ label }}</option>
      </select>
    </label>
    <p>Проверка графа не подтверждает вывод исторического источника.</p>
    <label v-if="review.status === 'NEEDS_CORRECTION'">Комментарий к отклонению (необязательно)
      <textarea :value="review.comment" maxlength="5000" rows="3" @input="emit('update', 'NEEDS_CORRECTION', ($event.target as HTMLTextAreaElement).value)" />
    </label>
    <p v-if="review.reviewedAt">Дата проверки: <time :datetime="review.reviewedAt">{{ new Date(review.reviewedAt).toLocaleString('ru-RU') }}</time></p>
  </div>
</template>
