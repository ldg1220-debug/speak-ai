import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { generateGeminiJson, userPromptContents } from "@/lib/geminiText"
import type { UserMemory } from "@/lib/userMemory"

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })
  }

  let body: {
    messages: { role: string; text: string }[]
    existingMemory: Partial<UserMemory>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { messages, existingMemory } = body

  const convoText = messages
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
    .join("\n")

  const prompt = `You extract personal facts about a language learner from their conversation with an AI tutor.

Existing known facts:
- Name: ${existingMemory.name ?? "unknown"}
- Interests: ${(existingMemory.interests ?? []).join(", ") || "none yet"}
- Facts: ${(existingMemory.facts ?? []).join("; ") || "none yet"}

New conversation:
${convoText}

Extract any NEW information revealed. Return JSON only:
{
  "name": "learner's first name if mentioned — null if not",
  "interests": ["array of new interests/hobbies mentioned — empty if none"],
  "facts": ["personal facts: job, city, family, goals, life events — new ones only, in Korean or English"],
  "recentTopics": ["2-4 keywords summarising what was discussed today"],
  "learningPrefs": "any preference about how they want to learn — null if not mentioned"
}

Only include genuinely new information. Keep each fact concise (under 10 words).`

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const raw = await generateGeminiJson(ai, {
      contents: userPromptContents(prompt),
      maxOutputTokens: 300,
      temperature: 0.3,
    })
    const parsed = JSON.parse(raw) as Partial<UserMemory>
    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gemini failed" },
      { status: 502 }
    )
  }
}
