import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";

type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  // Persona
  const rawPersonaId = formData.get("personaId");
  const personaId: PersonaId =
    typeof rawPersonaId === "string" && rawPersonaId in PERSONAS
      ? (rawPersonaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];

  // Topic
  const topicId = formData.get("topicId");
  const topic = getTopicById(typeof topicId === "string" ? topicId : null);

  // News context
  let newsArticle: { title: string; summaryEn: string; openingQuestion: string } | null = null;
  const newsArticleRaw = formData.get("newsArticle");
  if (typeof newsArticleRaw === "string") {
    try { newsArticle = JSON.parse(newsArticleRaw); } catch { /* ignore */ }
  }

  // Conversation history
  let history: HistoryMessage[] = [];
  const historyRaw = formData.get("history");
  if (typeof historyRaw === "string") {
    try { history = JSON.parse(historyRaw); } catch { /* ignore */ }
  }

  // Settings flags
  const koreanToEnglish  = formData.get("koreanToEnglish")  === "true";
  const showKoreanSummary = formData.get("showKoreanSummary") === "true";

  // ── Step 1: Whisper STT ────────────────────────────────────────────────────
  let transcript: string;
  let pronunciationScore: number | null = null;
  let detectedLanguage = "en";
  try {
    const fileName = (audioFile as File).name ?? "recording.webm";
    const file = new File([audioFile], fileName, { type: audioFile.type });

    const stt = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    transcript       = stt.text.trim();
    detectedLanguage = stt.language ?? "en";

    if (detectedLanguage === "en" && stt.segments && stt.segments.length > 0) {
      const avgLogProb =
        stt.segments.reduce((sum, seg) => sum + seg.avg_logprob, 0) /
        stt.segments.length;
      pronunciationScore = Math.min(100, Math.max(0, Math.round((1 + avgLogProb) * 100)));
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Whisper STT failed." },
      { status: 502 }
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "Could not transcribe audio. Please speak more clearly." },
      { status: 422 }
    );
  }

  // ── Step 2: GPT (gpt-4o-mini for speed) ───────────────────────────────────
  const isKorean = detectedLanguage === "ko" || /[가-힣]/.test(transcript);

  let systemPrompt = persona.systemPrompt;
  if (topic) {
    systemPrompt += `\n\n**Current topic:** ${topic.promptHint}`;
  }
  if (newsArticle) {
    systemPrompt += `\n\n**News article to discuss:**\nTitle: ${newsArticle.title}\nSummary: ${newsArticle.summaryEn}\nOpening question: ${newsArticle.openingQuestion}\n\nGuide the conversation around this news article.`;
  }

  // Korean feature instructions
  const koreanInstructions: string[] = [];
  if (koreanToEnglish && isKorean) {
    koreanInstructions.push(
      `The user just spoke in Korean. Start your "reply" field with: "그 말은 영어로 '[English phrase]'라고 표현하면 돼요! 😊" — then continue your English response.`
    );
  }
  if (showKoreanSummary) {
    koreanInstructions.push(
      `At the very end of your "reply" field, add a line break and then a brief Korean summary starting with "📝 " that tells the user in Korean what you just said in English (2 sentences max).`
    );
  }
  if (koreanInstructions.length > 0) {
    systemPrompt += `\n\n**Special instructions for this response:**\n${koreanInstructions.join("\n")}`;
  }

  type EmotionValue = "neutral" | "happy" | "sad" | "surprised" | "thinking";
  let correction: string | null = null;
  let emotion: EmotionValue = "neutral";
  let reply: string;
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-14).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: transcript },
    ];

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",   // faster than gpt-4o
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
    emotion    = (parsed.emotion as typeof emotion) ?? "neutral";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GPT request failed." },
      { status: 502 }
    );
  }

  // ── Step 3: TTS ───────────────────────────────────────────────────────────
  // Strip Korean summary from TTS (only speak the English part)
  const ttsText = reply.split("📝")[0].trim();

  let audioBase64: string;
  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: persona.voice,
      input: ttsText || reply,
      response_format: "mp3",
    });
    audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    transcript,
    correction,
    reply,
    emotion,
    audio: audioBase64,
    pronunciationScore,
    language: detectedLanguage,
  });
}
