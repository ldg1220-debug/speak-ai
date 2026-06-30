import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";
import { memoryToPromptSnippet, type UserMemory } from "@/lib/userMemory";

type HistoryMessage = { role: "user" | "assistant"; content: string };
type EmotionValue   = "neutral" | "happy" | "sad" | "surprised" | "thinking";

const TEXT_MODEL = "gemini-2.5-flash";

// Preview/flash models occasionally return transient 503 "high demand"
// errors — retry once after a short delay before giving up.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("UNAVAILABLE") && !message.includes("503")) throw err;
    await new Promise((r) => setTimeout(r, 1000));
    return fn();
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: {
    text?: string;
    history?: HistoryMessage[];
    personaId?: string;
    topicId?: string | null;
    newsArticle?: { title: string; summaryEn: string; openingQuestion: string } | null;
    koreanToEnglish?: boolean;
    showKoreanSummary?: boolean;
    userMemory?: Partial<UserMemory>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    text, history = [], personaId: rawPersonaId, topicId, newsArticle,
    koreanToEnglish = false, showKoreanSummary = false, userMemory = {},
  } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const personaId: PersonaId =
    typeof rawPersonaId === "string" && rawPersonaId in PERSONAS
      ? (rawPersonaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];
  const topic   = getTopicById(typeof topicId === "string" ? topicId : null);

  const isKorean = /[가-힣]/.test(text.trim());

  let systemPrompt = persona.systemPrompt;
  const memSnippet = memoryToPromptSnippet(userMemory as UserMemory);
  if (memSnippet) systemPrompt += `\n\n${memSnippet}`;
  if (topic) systemPrompt += `\n\n**Current topic:** ${topic.promptHint}`;
  if (newsArticle) {
    systemPrompt += `\n\n**News article to discuss:**\nTitle: ${newsArticle.title}\nSummary: ${newsArticle.summaryEn}\nOpening question: ${newsArticle.openingQuestion}\n\nGuide the conversation around this news article.`;
  }

  const koreanInstructions: string[] = [];
  if (koreanToEnglish && isKorean) {
    koreanInstructions.push(
      `The user just typed in Korean. Start your "reply" field with: "그 말은 영어로 '[English phrase]'라고 표현하면 돼요! 😊" — then continue your English response.`
    );
  }
  if (showKoreanSummary) {
    koreanInstructions.push(
      `At the very end of your "reply" field, add a line break and then a brief Korean summary starting with "📝 " that tells the user in Korean what you just said in English (2 sentences max).`
    );
  }
  if (koreanInstructions.length > 0) {
    systemPrompt += `\n\n**Special instructions:**\n${koreanInstructions.join("\n")}`;
  }

  try {
    const contents = [
      ...history.slice(-14).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: text.trim() }] },
    ];
    const t0 = Date.now();
    const chat = await withRetry(() => ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: personaId === "sterling" ? 0.6 : 0.8,
        maxOutputTokens: 350,
      },
    }));
    console.log(`[chat/text] Gemini text generation took ${Date.now() - t0}ms`);
    const parsed = JSON.parse(chat.text ?? "{}") as {
      correction?: string | null;
      reply?: string;
      emotion?: string;
    };
    const correction = parsed.correction ?? null;
    const reply       = parsed.reply ?? "Sorry, I couldn't generate a reply.";
    const emotion: EmotionValue = (parsed.emotion as EmotionValue) ?? "neutral";
    return NextResponse.json({ reply, correction, emotion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gemini request failed." },
      { status: 502 },
    );
  }
}
