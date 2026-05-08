export interface Topic {
  id: string
  emoji: string
  nameKo: string
  promptHint: string
}

export const TOPICS: Topic[] = [
  { id: 'daily',         emoji: '☕', nameKo: '일상',     promptHint: 'Steer the conversation toward everyday life: daily routines, hobbies, feelings, and personal stories.' },
  { id: 'travel',        emoji: '✈️', nameKo: '여행',     promptHint: 'Steer the conversation toward travel: planning trips, describing destinations, transportation, and accommodation.' },
  { id: 'business',      emoji: '💼', nameKo: '비즈니스', promptHint: 'Steer the conversation toward professional topics: work situations, meetings, presentations, and career growth.' },
  { id: 'food',          emoji: '🍕', nameKo: '음식',     promptHint: 'Steer the conversation toward food: favourite dishes, restaurants, cooking, and food culture.' },
  { id: 'entertainment', emoji: '🎬', nameKo: '영화/TV',  promptHint: 'Steer the conversation toward pop culture: movies, TV shows, music, books, and celebrity news.' },
  { id: 'tech',          emoji: '💻', nameKo: '테크',     promptHint: 'Steer the conversation toward technology: gadgets, apps, AI, gaming, and digital trends.' },
  { id: 'sports',        emoji: '⚽', nameKo: '스포츠',   promptHint: 'Steer the conversation toward sports and fitness: favourite sports, exercise habits, and health.' },
  { id: 'relationships', emoji: '❤️', nameKo: '관계',     promptHint: 'Steer the conversation toward relationships: friendship, family, dating, and social experiences.' },
]

export function getTopicById(id: string | null): Topic | null {
  if (!id) return null
  return TOPICS.find((t) => t.id === id) ?? null
}
