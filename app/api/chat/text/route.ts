import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";

type HistoryMessage = { role: "user" | "assistant"; content: string };
type EmotionValue   = "neutral" | "happy" | "sad" | "surprised" | "thinking";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  let body: {
    text?: string;
    history?: HistoryMessage[];
    personaId?: string;
    topicId?: string | null;
    newsArticle?: { title: string; summaryEn: string; openingQuestion: string } | null;
    koreanToEnglish?: boolean;
    showKoreanSummary?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    text, history = [], personaId: rawPersonaId, topicId, newsArticle,
    koreanToEnglish = false, showKoreanSummary = false,
  } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const personaId: PersonaId =
    typeof rawPersonaId === "string" && rawPersonaId in PERSONAS
      ? (rawPersonaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];
  const topic   = getTopicById(typeof topicId === "string" ? topicId : null);

  const isKorean = /[가-힣]/.test(text.trim());

  let systemPrompt = persona.systemPrompt;
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

  let correction: string | null = null;
  let emotion: EmotionValue     = "neutral";
  let reply: string;

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-14).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text.trim() },
    ];
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",   // faster
      response_format: { type: "json_object" },
      messages,
      temperature: personaId === "sterling" ? 0.6 : 0.8,
      max_tokens: 350,
    });
    const parsed = JSON.parse(chat.choices[0]?.message?.content ?? "{}") as {
      correction?: string | null;
      reply?: string;
      emotion?: string;
    };
    correction = parsed.correction ?? null;
    reply      = parsed.reply ?? "Sorry, I couldn't generate a reply.";
    emotion    = (parsed.emotion as EmotionValue) ?? "neutral";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GPT request failed." },
      { status: 502 },
    );
  }

  // TTS: only speak the English part (strip Korean 📝 summary)
  const ttsText = reply.split("📝")[0].trim();

  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: persona.voice,
      input: ttsText || reply,
      response_format: "mp3",
    });
    const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");
    return NextResponse.json({ reply, correction, emotion, audio: audioBase64 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed." },
      { status: 502 },
    );
  }
}
