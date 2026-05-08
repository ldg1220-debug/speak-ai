import type { PersonaId } from './personas'

export interface StoredMessage {
  role: 'user' | 'assistant'
  text: string
  correction: string | null
  pronunciationScore: number | null
  timestamp: string
}

export interface SessionReportData {
  overallScore: number
  corrections: { original: string; corrected: string; explanation: string }[]
  vocabularyHighlights: string[]
  strengths: string[]
  recommendations: string[]
  overallFeedback: string
}

export interface StoredSession {
  id: string
  personaId: PersonaId
  topicId: string | null
  startedAt: string
  endedAt: string
  messageCount: number
  messages: StoredMessage[]
  avgPronunciationScore: number | null
  report: SessionReportData | null
}

const STORAGE_KEY = 'speakai_sessions'
const MAX_SESSIONS = 30

function isBrowser() {
  return typeof window !== 'undefined'
}

export function loadSessions(): StoredSession[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession[]) : []
  } catch {
    return []
  }
}

export function saveSession(session: StoredSession): void {
  if (!isBrowser()) return
  try {
    const sessions = loadSessions()
    // Remove old entry for same id if exists, add to front
    const updated = [session, ...sessions.filter((s) => s.id !== session.id)]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, MAX_SESSIONS)))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return
  try {
    const sessions = loadSessions().filter((s) => s.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {}
}

export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function calcAvgPronunciation(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null && s >= 0)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}
