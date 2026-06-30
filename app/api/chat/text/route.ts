import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";
import { memoryToPromptSnippet, type UserMemory } from "@/lib/userMemory";

type HistoryMessage = { role: "user" | "assistant"; content: string };
type EmotionValue   = "neutral" | "happy" | "sad" | "surprised" | "thinking";

const TEXT_MODEL = "gemini-2.5-flash";
const TTS_MODEL  = "gemini-2.5-flash-preview-tts";
const TTS_SAMPLE_RATE = 24000;

// Gemini TTS returns raw 16-bit PCM with no header — wrap it as WAV so
// the browser's decodeAudioData() can play it.
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
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

  let correction: string | null = null;
  let emotion: EmotionValue     = "neutral";
  let reply: string;

  try {
    const contents = [
      ...history.slice(-14).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: text.trim() }] },
    ];
    const chat = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: personaId === "sterling" ? 0.6 : 0.8,
        maxOutputTokens: 350,
      },
    });
    const parsed = JSON.parse(chat.text ?? "{}") as {
      correction?: string | null;
      reply?: string;
      emotion?: string;
    };
    correction = parsed.correction ?? null;
    reply      = parsed.reply ?? "Sorry, I couldn't generate a reply.";
    emotion    = (parsed.emotion as EmotionValue) ?? "neutral";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gemini request failed." },
      { status: 502 },
    );
  }

  // TTS: only speak the English part (strip Korean 📝 summary)
  const ttsText = reply.split("📝")[0].trim();

  try {
    const tts = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: ttsText || reply }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.geminiVoice } },
        },
      },
    });
    const pcmBase64 = tts.data;
    if (!pcmBase64) throw new Error("No audio returned from TTS.");
    const wav = pcmToWav(Buffer.from(pcmBase64, "base64"), TTS_SAMPLE_RATE);
    return NextResponse.json({ reply, correction, emotion, audio: wav.toString("base64") });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed." },
      { status: 502 },
    );
  }
}
