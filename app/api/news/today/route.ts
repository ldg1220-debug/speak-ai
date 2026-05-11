import { NextRequest, NextResponse } from "next/server";
import { MOCK_ARTICLES, type Article } from "@/lib/mockArticles";

export const dynamic = "force-dynamic";

function categoryToGNews(category: string): { topic: string; country: string } {
  if (category === "entertainment") return { topic: "entertainment", country: "kr" };
  if (category === "business")      return { topic: "business",      country: "us" };
  if (category === "tech")          return { topic: "technology",    country: "us" };
  if (category === "korea")         return { topic: "general",       country: "kr" };
  return { topic: "world", country: "us" };
}

async function fetchLiveNews(category: string): Promise<{ source: string; articles: Article[] }> {
  const gnewsApiKey = process.env.GNEWS_API_KEY;
  if (!gnewsApiKey) {
    return { source: "mock", articles: MOCK_ARTICLES };
  }

  const { topic, country } = categoryToGNews(category);
  const url = new URL("https://gnews.io/api/v4/top-headlines");
  url.searchParams.set("apikey", gnewsApiKey);
  url.searchParams.set("lang", "en");
  url.searchParams.set("country", country);
  url.searchParams.set("topic", topic);
  url.searchParams.set("max", "10");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`GNews error: ${res.status}`);

    const data = await res.json() as { articles?: { title: string; url: string; description?: string; content?: string; source?: { name?: string } }[] };
    const articles: Article[] = (data.articles ?? []).map((item, index) => ({
      id: `live-${Date.now()}-${index}`,
      category,
      region: country === "kr" ? "korea" : "world",
      source: item.source?.name ?? "Live News",
      level: "Intermediate",
      title: item.title,
      url: item.url,
      summaryEn: item.description ?? item.content ?? item.title,
      summaryKo: "AI 분석 버튼을 누르면 한국어 요약이 생성됩니다.",
      openingQuestion: "What is your first reaction to this news?",
      vocabulary: [],
    }));

    return { source: "gnews", articles };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("GNews request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "all";
  try {
    const result = await fetchLiveNews(category);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch news" },
      { status: 502 },
    );
  }
}
