import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a friendly, expert English tutor. The user is practicing English conversation.
You must return your response in a strict JSON format with two keys:
1. "correction": Identify any grammatical errors or unnatural phrasing in the user's input and provide a natural alternative. If it's perfect, return null.
2. "reply": A conversational response to keep the chat going. Keep it concise (1-2 sentences).`;

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

  // Step 1: STT via Whisper
  let transcript: string;
  try {
    const fileName = (audioFile as File).name ?? "recording.webm";
    const file = new File([audioFile], fileName, { type: audioFile.type });
    const sttResponse = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
    });
    transcript = sttResponse.text.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Whisper STT failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "Could not transcribe audio. Please speak more clearly." }, { status: 422 });
  }

  // Step 2: LLM via GPT-4o
  let correction: string | null = null;
  let reply: string;
  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const raw = chat.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { correction?: string | null; reply?: string };
    correction = parsed.correction ?? null;
    reply = parsed.reply ?? "Sorry, I couldn't generate a reply.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "GPT-4o request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Step 3: TTS via OpenAI
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

  return NextResponse.json({
    transcript,
    correction,
    reply,
    audio: audioBase64,
  });
}
