import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Article } from "@/lib/mockArticles";

async function fetchArticleContent(url: string): Promise<string | null> {
  if (!url || url === "#") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const noScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const clean = noScript.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
    return clean.length > 200 ? clean.slice(0, 4000) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  beginner:     "Target level: Beginner (A1-A2). Use very simple words (top 1000 English words). Short sentences. Basic grammar only. Vocabulary items should be common everyday words.",
  intermediate: "Target level: Intermediate (B1-B2). Use standard news vocabulary. Normal sentence complexity. Mix of common and topic-specific words.",
  advanced:     "Target level: Advanced (C1-C2). Use sophisticated vocabulary, technical terms, idioms. Complex sentence structures. Challenge the learner.",
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  let body: { article: Article; difficulty?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { article, difficulty = "intermediate" } = body;
  const fallback = {
    summaryEn: article.summaryEn,
    summaryKo: article.summaryKo ?? "AI 키가 없어 샘플 한국어 요약을 표시합니다.",
    openingQuestion: article.openingQuestion ?? "What do you think about this news?",
    vocabulary: article.vocabulary?.length > 0
      ? article.vocabulary
      : [
          ["headline", "기사 제목", "noun", "The headline explains the main topic."],
          ["source",   "출처",     "noun", "A reliable source is important."],
          ["issue",    "쟁점",     "noun", "This issue affects many people."],
          ["response", "반응",     "noun", "People had different responses to the news."],
        ],
  };

  const fullContent = await fetchArticleContent(article.url);
  const articleText = fullContent ?? article.summaryEn;

  const prompt = `You are an English learning content generator for Korean learners.
${DIFFICULTY_INSTRUCTIONS[difficulty] ?? DIFFICULTY_INSTRUCTIONS.intermediate}
Return only valid JSON with this shape:
{
  "summaryEn": "80-120 words in clear English",
  "summaryKo": "Korean summary",
  "openingQuestion": "one friendly English conversation question",
  "vocabulary": [["word or phrase", "Korean meaning", "part of speech", "English example sentence"]]
}
Create 12 useful vocabulary items.

Title: ${article.title}
Source: ${article.source}
Text: ${articleText}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    });

    const parsed = JSON.parse(chat.choices[0]?.message?.content ?? "{}") as {
      summaryEn?: string;
      summaryKo?: string;
      openingQuestion?: string;
      vocabulary?: [string, string, string, string][];
    };

    if (!parsed.summaryEn || !Array.isArray(parsed.vocabulary)) {
      return NextResponse.json({ source: "mock", ...fallback });
    }

    return NextResponse.json({ source: "openai", ...fallback, ...parsed });
  } catch (err) {
    console.error("[articles/analyze]", err);
    return NextResponse.json({ source: "mock", ...fallback });
  }
}
