import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { synthesizeGeminiSpeech } from "@/lib/geminiTts";

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: { text?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { text } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const audio = await synthesizeGeminiSpeech(ai, text.slice(0, 500), "Kore");
    return NextResponse.json({ audio });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed." },
      { status: 502 }
    );
  }
}
