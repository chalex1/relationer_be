import { RelationType } from '../api/generated/models/RelationType'
export const typePresentation = {
  [RelationType.BIOLOGICAL]: { label: 'Родитель → ребёнок', short: 'родитель', color: '#58765f', dash: undefined },
  [RelationType.MARRIAGE]: { label: 'Супруги', short: 'брак', color: '#b08a5b', dash: undefined },
  [RelationType.SPIRITUAL]: { label: 'Крёстный → крестник', short: 'крещение', color: '#6485ab', dash: '6 4' },
  [RelationType.ADOPTION]: { label: 'Приёмный родитель → ребёнок', short: 'усыновление', color: '#9b7da9', dash: '3 4' },
}
