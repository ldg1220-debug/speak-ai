import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PERSONAS, PersonaId, DEFAULT_PERSONA } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";
import type { SessionReportData } from "@/lib/storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ReportRequestMessage {
  role: "user" | "assistant";
  text: string;
  correction: string | null;
  pronunciationScore: number | null;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  let body: {
    messages: ReportRequestMessage[];
    personaId: string;
    topicId: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, topicId } = body;

  const personaId: PersonaId =
    body.personaId in PERSONAS ? (body.personaId as PersonaId) : DEFAULT_PERSONA;
  const persona = PERSONAS[personaId];
  const topic   = getTopicById(topicId);

  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    return NextResponse.json({ error: "No user messages to analyze." }, { status: 422 });
  }

  // Compute avg pronunciation for context
  const scores = userMessages
    .map((m) => m.pronunciationScore)
    .filter((s): s is number => s !== null);
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const promptContext = [
    `Tutor persona: ${persona.name} (${persona.roleEn})`,
    topic ? `Conversation topic: ${topic.nameKo}` : null,
    `Number of user messages: ${userMessages.length}`,
    avgScore !== null ? `Average pronunciation score: ${avgScore}/100` : null,
    ``,
    `User's messages (in order):`,
    ...userMessages.map((m, i) => `${i + 1}. "${m.text}"`),
    ``,
    `Grammar corrections already given during conversation:`,
    ...userMessages
      .filter((m) => m.correction)
      .map((m) => `- Original: "${m.text}" → Correction: "${m.correction}"`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const systemPrompt = `You are an expert English language coach generating a post-session learning report.
Analyze the learner's English usage and return a JSON report that is honest, specific, and highly encouraging.
Always use a positive tone — celebrate what they did well and frame improvements as exciting opportunities.`;

  const userPrompt = `${promptContext}

Generate a detailed learning report as valid JSON with exactly these keys:
{
  "overallScore": <integer 0-100 reflecting grammar, vocabulary, and fluency>,
  "corrections": [
    { "original": "<what they said>", "corrected": "<better version>", "explanation": "<brief why>" }
  ],
  "vocabularyHighlights": ["<notable words/phrases they used well or should learn>"],
  "strengths": ["<specific things they did well>"],
  "recommendations": ["<specific, actionable things to practice next>"],
  "overallFeedback": "<2-3 sentences of warm, encouraging overall summary>"
}`;

  let report: SessionReportData;
  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    report = JSON.parse(chat.choices[0]?.message?.content ?? "{}") as SessionReportData;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed." },
      { status: 502 }
    );
  }

  return NextResponse.json(report);
}
