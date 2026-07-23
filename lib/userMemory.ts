export interface UserMemory {
  name: string | null
  interests: string[]
  facts: string[]           // "서울 거주", "직장인", "여행 좋아함" etc.
  recentTopics: string[]    // last 10 convo topics/keywords
  learningPrefs: string | null // "한국어 설명 선호", "비즈니스 영어 집중" etc.
  totalSessions: number
  lastActive: string | null
}

const KEY = "speakai_user_memory"

export function emptyMemory(): UserMemory {
  return {
    name: null,
    interests: [],
    facts: [],
    recentTopics: [],
    learningPrefs: null,
    totalSessions: 0,
    lastActive: null,
  }
}

export function loadMemory(): UserMemory {
  if (typeof window === "undefined") return emptyMemory()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyMemory()
    return { ...emptyMemory(), ...JSON.parse(raw) } as UserMemory
  } catch {
    return emptyMemory()
  }
}

export function saveMemory(memory: UserMemory): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {}
}

export function mergeMemory(existing: UserMemory, patch: Partial<UserMemory>): UserMemory {
  const merged: UserMemory = {
    ...existing,
    name: patch.name ?? existing.name,
    learningPrefs: patch.learningPrefs ?? existing.learningPrefs,
    totalSessions: existing.totalSessions,
    lastActive: new Date().toISOString(),
    interests: dedupe([...existing.interests, ...(patch.interests ?? [])]).slice(0, 12),
    facts: dedupe([...existing.facts, ...(patch.facts ?? [])]).slice(0, 20),
    recentTopics: dedupe([...(patch.recentTopics ?? []), ...existing.recentTopics]).slice(0, 10),
  }
  return merged
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))]
}

export function memoryToPromptSnippet(mem: UserMemory): string {
  if (
    !mem.name &&
    mem.interests.length === 0 &&
    mem.facts.length === 0 &&
    mem.recentTopics.length === 0 &&
    !mem.learningPrefs
  ) {
    return ""
  }

  const lines: string[] = ["**About this learner (use naturally in conversation — don't recite like a list):**"]
  if (mem.name) lines.push(`- Name: ${mem.name}`)
  if (mem.interests.length) lines.push(`- Known interests: ${mem.interests.join(", ")}`)
  if (mem.facts.length) lines.push(`- Personal facts: ${mem.facts.join("; ")}`)
  if (mem.recentTopics.length) lines.push(`- Recently talked about: ${mem.recentTopics.slice(0, 5).join(", ")}`)
  if (mem.learningPrefs) lines.push(`- Learning preference: ${mem.learningPrefs}`)
  if (mem.totalSessions > 1) lines.push(`- This is session #${mem.totalSessions} — greet them like an old friend, reference past topics naturally.`)
  lines.push("")
  lines.push("Reference what you know about them naturally. Ask follow-up questions tied to their interests. Make them feel remembered.")

  return lines.join("\n")
}
