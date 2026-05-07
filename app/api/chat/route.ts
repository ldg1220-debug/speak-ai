import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

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

  // Resolve persona
  const rawPersonaId = formData.get("personaId");
  const personaId: PersonaId =
    typeof rawPersonaId === "string" && rawPersonaId in PERSONAS
      ? (rawPersonaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];

  // Parse conversation history
  let history: HistoryMessage[] = [];
  const historyRaw = formData.get("history");
  if (typeof historyRaw === "string") {
    try { history = JSON.parse(historyRaw); } catch { /* ignore */ }
  }

  // ── Step 1: Whisper STT ──────────────────────────────────────────────────
  let transcript: string;
  try {
    const fileName = (audioFile as File).name ?? "recording.webm";
    const file = new File([audioFile], fileName, { type: audioFile.type });
    const stt = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      // No forced language — supports Korean + English
    });
    transcript = stt.text.trim();
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

  // ── Step 2: GPT-4o with persona prompt + history ─────────────────────────
  let correction: string | null = null;
  let reply: string;
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: persona.systemPrompt },
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: transcript },
    ];

    const chat = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages,
      temperature: personaId === "sterling" ? 0.6 : 0.8,
      max_tokens: 400,
    });

    const parsed = JSON.parse(chat.choices[0]?.message?.content ?? "{}") as {
      correction?: string | null;
      reply?: string;
    };
    correction = parsed.correction ?? null;
    reply      = parsed.reply ?? "Sorry, I couldn't generate a reply.";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GPT-4o request failed." },
      { status: 502 }
    );
  }

  // ── Step 3: TTS with persona voice ───────────────────────────────────────
  let audioBase64: string;
  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: persona.voice,
      input: reply,
      response_format: "mp3",
    });
    audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed." },
      { status: 502 }
    );
  }

  return NextResponse.json({ transcript, correction, reply, audio: audioBase64 });
}
