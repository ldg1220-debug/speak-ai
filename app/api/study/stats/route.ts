import { NextRequest, NextResponse } from "next/server";
import { supabaseRequest, isSupabaseConfigured } from "@/lib/supabase";

interface StudyLog {
  event_type: string;
  difficulty: string;
  created_at: string;
}

interface SavedWordId {
  id: string;
}

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ logs: [], totalSavedWords: 0 });
  }

  try {
    const [logs, words] = await Promise.all([
      supabaseRequest<StudyLog[]>(
        `study_logs?device_id=eq.${encodeURIComponent(deviceId)}&select=event_type,difficulty,created_at&order=created_at.desc`,
      ),
      supabaseRequest<SavedWordId[]>(
        `saved_words?device_id=eq.${encodeURIComponent(deviceId)}&select=id`,
      ),
    ]);
    return NextResponse.json({
      logs: logs ?? [],
      totalSavedWords: (words ?? []).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
