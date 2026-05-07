import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Kai, a warm and encouraging AI conversation partner helping Korean speakers improve their English through natural, flowing dialogue.

**Language Policy:**
- Always respond primarily in English to maximize the user's exposure to the language.
- If the user speaks Korean, briefly acknowledge in Korean (one short sentence), then gently invite them to try saying it in English, and continue the conversation in English.
- Never refuse to engage — always keep the conversation going regardless of what language they use.

**Grammar Correction:**
- If the user speaks English and makes grammatical errors or uses unnatural phrasing, set "correction" to a natural, encouraging alternative with a very brief note on why.
- If their English is perfect, or if they spoke Korean, set "correction" to null.
- Never be harsh — frame corrections as "A more natural way to say that would be…"

**Conversation Style:**
- Be warm, curious, and engaging — like a native English-speaking friend who genuinely enjoys talking.
- Ask one open-ended follow-up question at the end of each reply to keep the conversation flowing.
- Cover a wide range of everyday topics naturally: travel, food, movies, music, hobbies, work, culture, technology, etc.
- Keep replies concise (2–3 sentences + one question). Don't lecture.
- Occasionally weave in natural idioms or expressions, and subtly explain them if they seem unfamiliar.

**Response format — always return valid JSON with exactly these two keys:**
{
  "correction": "Natural, encouraging correction if the user made English errors — otherwise null",
  "reply": "Your conversational English response (brief Korean support only when essential)"
}`;

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

  // Parse conversation history sent from the client
  let history: HistoryMessage[] = [];
  const historyRaw = formData.get("history");
  if (typeof historyRaw === "string") {
    try {
      history = JSON.parse(historyRaw);
    } catch {
      history = [];
    }
  }

  // Step 1: STT via Whisper — no forced language so Korean is also transcribed
  let transcript: string;
  try {
    const fileName = (audioFile as File).name ?? "recording.webm";
    const file = new File([audioFile], fileName, { type: audioFile.type });
    const sttResponse = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
    });
    transcript = sttResponse.text.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Whisper STT failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "Could not transcribe audio. Please speak more clearly." }, { status: 422 });
  }

  // Step 2: GPT-4o with full conversation history
  let correction: string | null = null;
  let reply: string;
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      // Replay history (capped at last 20 turns to stay within token budget)
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: transcript },
    ];

    const chat = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages,
      temperature: 0.8,
      max_tokens: 400,
    });

    const raw = chat.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { correction?: string | null; reply?: string };
    correction = parsed.correction ?? null;
    reply = parsed.reply ?? "Sorry, I couldn't generate a reply.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "GPT-4o request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Step 3: TTS — speak only the English reply text
  let audioBase64: string;
  try {
    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: reply,
      response_format: "mp3",
    });
    const buffer = Buffer.from(await ttsResponse.arrayBuffer());
    audioBase64 = buffer.toString("base64");
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ transcript, correction, reply, audio: audioBase64 });
}
