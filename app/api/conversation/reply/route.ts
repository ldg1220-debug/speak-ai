import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const TOPIC_INSTRUCTIONS: Record<string, string> = {
  news:     "Focus on discussing the news article. Ask about opinions, causes, and effects.",
  daily:    "Have a casual American daily-life conversation. Use everyday American expressions and slang naturally.",
  business: "Use professional American business English. Discuss workplace, career, and professional topics.",
  travel:   "Simulate travel scenarios (airport, hotel, restaurant, directions). Use practical American English.",
  free:     "Have a free-flowing conversation on any topic the learner brings up.",
};

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  beginner:     "Use very simple English. Short sentences. Basic vocabulary only. Be encouraging and patient.",
  intermediate: "Use standard conversational English. Normal complexity.",
  advanced:     "Use sophisticated language. Challenge the learner with complex questions and corrections.",
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  let body: {
    article: { title: string; summaryEn: string };
    message: string;
    chatCount: number;
    difficulty?: string;
    conversationTopic?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { article, message, chatCount, difficulty = "intermediate", conversationTopic = "news" } = body;

  const fallback = {
    reply:
      chatCount % 2 === 0
        ? "Can you explain your opinion with one specific example?"
        : "That is a useful point. What is one possible risk or limitation?",
    correction:
      message.length < 20
        ? "Try expanding your answer: I think this issue matters because it affects people's daily choices."
        : `More natural version: ${message.replace(/^i\b/, "I")}`,
  };

  const isKorean = /[가-힣ㄱ-ㆎ]/.test(message);
  const topicContext = TOPIC_INSTRUCTIONS[conversationTopic] ?? TOPIC_INSTRUCTIONS.news;

  const prompt = isKorean
    ? `You are a friendly American English expression coach for a Korean learner.
The learner wrote in Korean — they are expressing what they WANT TO SAY in English.
Your job is to give them the natural English expression for what they mean.

Return only valid JSON:
{"reply":"The natural English expression, then a follow-up question in English to continue the conversation","correction":"Explain the expression: when to use it, why it sounds natural, and any similar American expressions or alternatives"}

News topic: ${article.title}
What the learner wants to express (in Korean): ${message}`
    : `You are a friendly American English conversation coach for a Korean learner.
${DIFFICULTY_INSTRUCTIONS[difficulty] ?? DIFFICULTY_INSTRUCTIONS.intermediate}
Conversation style: ${topicContext}

IMPORTANT for the correction field:
- Always provide a more natural American English version of what the learner said
- If they used unnatural phrasing, show how Americans actually say it
- Include real American expressions, idioms, or colloquialisms when relevant
- Format: "More natural: '[better version]' — In America, people often say '[expression]' in this situation."
- If their English was already natural, say "Great! That sounds natural." and add one bonus American expression.

Return only valid JSON:
{"reply":"one conversational follow-up in English","correction":"American English coaching with natural alternative"}

News title: ${article.title}
News summary: ${article.summaryEn}
Learner answer: ${message}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    const parsed = JSON.parse(chat.choices[0]?.message?.content ?? "{}") as {
      reply?: string;
      correction?: string;
    };

    if (!parsed.reply) return NextResponse.json({ source: "mock", ...fallback });
    return NextResponse.json({ source: "openai", ...fallback, ...parsed });
  } catch (err) {
    console.error("[conversation/reply]", err);
    return NextResponse.json({ source: "mock", ...fallback });
  }
}
