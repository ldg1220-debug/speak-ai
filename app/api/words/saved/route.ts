import { NextRequest, NextResponse } from "next/server";
import { supabaseRequest, isSupabaseConfigured } from "@/lib/supabase";

interface SavedWord {
  article_id: string;
  word: string;
  meaning_ko: string;
  part_of_speech: string;
  example: string;
}

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ words: [] });
  }

  try {
    const rows = await supabaseRequest<SavedWord[]>(
      `saved_words?device_id=eq.${encodeURIComponent(deviceId)}&select=article_id,word,meaning_ko,part_of_speech,example&order=created_at.desc`,
    );
    return NextResponse.json({ words: rows ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch saved words" },
      { status: 500 },
    );
  }
}
