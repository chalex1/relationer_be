import { RelationCategory } from '../api/generated/models/RelationCategory'
import { VerdictDto } from '../api/generated/models/VerdictDto'
export const categoryLabels: Record<RelationCategory, string> = { BLOOD: 'Кровное родство', AFFINITY: 'Свойство', SPIRITUAL: 'Духовное родство', ADOPTION: 'Усыновление' }
export const verdictLabels: Record<VerdictDto, string> = { FORBIDDEN: 'Запрещено', ALLOWED: 'Разрешено', UNDETERMINED: 'Не определено' }
