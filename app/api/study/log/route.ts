import { NextRequest, NextResponse } from "next/server";
import { supabaseRequest, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: {
    deviceId: string;
    eventType: string;
    articleId?: string;
    difficulty?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { deviceId, eventType, articleId, difficulty } = body;
  if (!deviceId || !eventType) {
    return NextResponse.json({ error: "deviceId and eventType required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, note: "Supabase not configured — log not persisted." });
  }

  try {
    await supabaseRequest("study_logs", "POST", {
      device_id: deviceId,
      event_type: eventType,
      article_id: articleId,
      difficulty,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to log study event" },
      { status: 500 },
    );
  }
}
