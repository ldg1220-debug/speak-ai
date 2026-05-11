import { NextRequest, NextResponse } from "next/server";
import { supabaseRequest, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: {
    deviceId: string;
    articleId: string;
    word: string;
    meaningKo: string;
    partOfSpeech: string;
    example: string;
    action?: "save" | "unsave";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { deviceId, articleId, word, meaningKo, partOfSpeech, example, action } = body;
  if (!deviceId || !word) {
    return NextResponse.json({ error: "deviceId and word required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, note: "Supabase not configured — word not persisted." });
  }

  try {
    if (action === "unsave") {
      await supabaseRequest(
        `saved_words?device_id=eq.${encodeURIComponent(deviceId)}&article_id=eq.${encodeURIComponent(articleId)}&word=eq.${encodeURIComponent(word)}`,
        "DELETE",
      );
    } else {
      await supabaseRequest("saved_words", "POST", {
        device_id: deviceId,
        article_id: articleId,
        word,
        meaning_ko: meaningKo,
        part_of_speech: partOfSpeech,
        example,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save word" },
      { status: 500 },
    );
  }
}
