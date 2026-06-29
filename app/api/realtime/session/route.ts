import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { PERSONAS, DEFAULT_PERSONA, PersonaId, toLiveInstructions } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";
import { memoryToPromptSnippet, type UserMemory } from "@/lib/userMemory";
import { reportTurnDeclaration } from "@/lib/geminiLiveTools";

export const runtime = "nodejs";

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: {
    personaId?: string;
    topicId?: string | null;
    newsArticle?: { title: string; summaryEn: string; openingQuestion: string } | null;
    userMemory?: Partial<UserMemory>;
    koreanToEnglish?: boolean;
    showKoreanSummary?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const personaId: PersonaId =
    typeof body.personaId === "string" && body.personaId in PERSONAS
      ? (body.personaId as PersonaId)
      : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];

  const topic = getTopicById(body.topicId ?? null);
  const newsArticle = body.newsArticle ?? null;

  let extra = "";
  const memSnippet = memoryToPromptSnippet((body.userMemory ?? {}) as UserMemory);
  if (memSnippet) extra += `\n\n${memSnippet}`;
  if (topic) extra += `\n\n**Current topic:** ${topic.promptHint}`;
  if (newsArticle) {
    extra += `\n\n**News article to discuss:**\nTitle: ${newsArticle.title}\nSummary: ${newsArticle.summaryEn}\nOpening question: ${newsArticle.openingQuestion}\n\nGuide the conversation around this news article.`;
  }

  const koreanInstructions: string[] = [];
  if (body.koreanToEnglish) {
    koreanInstructions.push(
      `If the user speaks in Korean, first say the natural English phrase for what they meant, then continue in English.`
    );
  }
  if (body.showKoreanSummary) {
    koreanInstructions.push(
      `Occasionally, after a longer English reply, briefly summarize what you just said in Korean in one short sentence.`
    );
  }
  if (koreanInstructions.length > 0) {
    extra += `\n\n**Special instructions:**\n${koreanInstructions.join("\n")}`;
  }

  const systemInstruction = toLiveInstructions(persona, extra || undefined);

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            tools: [{ functionDeclarations: [reportTurnDeclaration] }],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.geminiVoice } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    });

    if (!token.name) {
      return NextResponse.json({ error: "Failed to mint Gemini Live token." }, { status: 502 });
    }

    return NextResponse.json({
      token: token.name,
      model: LIVE_MODEL,
      voice: persona.geminiVoice,
    });
  } catch (err) {
    console.error("[realtime/session]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create Gemini Live session." },
      { status: 502 }
    );
  }
}
