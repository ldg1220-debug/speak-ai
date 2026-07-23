import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import { synthesizeGeminiSpeech } from "@/lib/geminiTts";

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: { text?: string; personaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, personaId: rawPersonaId } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const personaId: PersonaId =
    typeof rawPersonaId === "string" && rawPersonaId in PERSONAS
      ? (rawPersonaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];

  // Only speak the English part (strip Korean 📝 summary)
  const ttsText = text.split("📝")[0].trim() || text;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const t0 = Date.now();
    const audio = await synthesizeGeminiSpeech(ai, ttsText, persona.geminiVoice);
    console.log(`[chat/text/audio] Gemini TTS took ${Date.now() - t0}ms`);
    return NextResponse.json({ audio });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed." },
      { status: 502 },
    );
  }
}
