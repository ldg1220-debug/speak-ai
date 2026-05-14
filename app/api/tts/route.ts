import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 500 });
  }

  let body: { text?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { text, lang = "en" } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  // Pick voice based on language
  const voice = lang === "ko" ? "nova" : "nova";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text.slice(0, 500), // cap length
      response_format: "mp3",
    });
    const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");
    return NextResponse.json({ audio: audioBase64 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed." },
      { status: 502 }
    );
  }
}
