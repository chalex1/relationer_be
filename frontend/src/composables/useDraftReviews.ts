import { ref } from 'vue'
import { parseReviews, reviewFor, reviewStorageKey, serializeReviews } from '../domain/review'
import type { ReviewResult, ReviewResults, ReviewStatus } from '../domain/review'

export function useDraftReviews() {
  const results = ref<ReviewResults>(Object.create(null))
  const message = ref('')
  try {
    const saved = localStorage.getItem(reviewStorageKey)
    if (saved) results.value = parseReviews(saved)
  } catch { message.value = 'Не удалось восстановить локальные отметки. Можно импортировать сохранённый файл.' }

  function persist(next: ReviewResults) {
    results.value = next
    try { localStorage.setItem(reviewStorageKey, serializeReviews(next)); message.value = '' }
    catch { message.value = 'Отметки сохранены только до закрытия страницы. Скачайте экспорт: localStorage недоступен.' }
  }
  function update(id: string, fingerprint: string, status: ReviewStatus, comment = '') {
    persist({ ...results.value, [id]: { id, fingerprint, status, comment: status === 'NEEDS_CORRECTION' ? comment : '',
      reviewedAt: status === 'DRAFT' ? null : new Date().toISOString() } })
  }
  function exportResults(cases: { id: string; fingerprint: string }[]) {
    const all = { ...results.value }
    for (const entry of cases) if (!Object.hasOwn(all, entry.id)) {
      const { changed: _, ...record } = reviewFor(entry.id, entry.fingerprint, results.value)
      all[entry.id] = record
    }
    const url = URL.createObjectURL(new Blob([serializeReviews(all)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'review-results.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importResults(file: File) {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error()
      const imported = parseReviews(await file.text())
      persist({ ...results.value, ...imported })
      if (!message.value) message.value = 'Результаты импортированы. Отметки применены только к совпадающему содержимому кейсов.'
    } catch { message.value = 'Не удалось импортировать результаты: проверьте формат файла. Текущие отметки сохранены.' }
  }
  return { results, message, update, exportResults, importResults }
}
