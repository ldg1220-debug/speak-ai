"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2, Star, Trash2, Loader2, BookOpen, RotateCcw } from "lucide-react";

interface SavedWord {
  article_id: string;
  word: string;
  meaning_ko: string;
  part_of_speech: string;
  example: string;
}

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("newstalk_device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("newstalk_device_id", id); }
  return id;
}

async function speak(text: string, lang: "en" | "ko") {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) throw new Error("TTS failed");
    const { audio } = await res.json() as { audio: string };
    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.onended = () => URL.revokeObjectURL(url);
    await el.play();
  } catch {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ko" ? "ko-KR" : "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
}

const POS_STYLE: Record<string, string> = {
  noun:        "text-blue-400   bg-blue-400/10   border-blue-400/20",
  verb:        "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  adjective:   "text-amber-400  bg-amber-400/10  border-amber-400/20",
  adverb:      "text-violet-400 bg-violet-400/10 border-violet-400/20",
  phrase:      "text-rose-400   bg-rose-400/10   border-rose-400/20",
  expression:  "text-rose-400   bg-rose-400/10   border-rose-400/20",
  preposition: "text-slate-400  bg-slate-400/10  border-slate-400/20",
};

function WordCard({
  word, meaning_ko, part_of_speech, example,
  onRemove, speakingWord, onSpeak,
}: SavedWord & {
  onRemove: () => void;
  speakingWord: string | null;
  onSpeak: (w: string) => void;
}) {
  const posCls = POS_STYLE[part_of_speech?.toLowerCase()] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20";
  const isSpeaking = speakingWord === word;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 px-4 py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white text-sm">{word}</span>
          {part_of_speech && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${posCls}`}>
              {part_of_speech}
            </span>
          )}
          <button
            onClick={() => onSpeak(word)}
            disabled={isSpeaking}
            className="text-slate-600 hover:text-indigo-400 transition-colors disabled:opacity-50"
            title="발음 듣기"
          >
            {isSpeaking
              ? <Loader2 size={13} className="animate-spin text-indigo-400" />
              : <Volume2 size={13} />}
          </button>
        </div>
        <button
          onClick={onRemove}
          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="text-sm text-slate-200 font-medium">{meaning_ko}</p>
      {example && (
        <p className="text-xs text-slate-500 italic leading-relaxed">{example}</p>
      )}
    </div>
  );
}

export default function WordsPage() {
  const [words, setWords]           = useState<SavedWord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [speakingWord, setSpeaking] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    const deviceId = getDeviceId();
    try {
      // Try server first, fall back to localStorage
      const res = await fetch(`/api/words/saved?deviceId=${encodeURIComponent(deviceId)}`);
      if (res.ok) {
        const data = await res.json() as { words: SavedWord[] };
        setWords(data.words ?? []);
        return;
      }
    } catch { /* fall through to localStorage */ }

    // Fallback: read from localStorage saved key list
    const savedKeys: string[] = JSON.parse(localStorage.getItem("savedWords") ?? "[]");
    // We don't have word data in localStorage — show empty
    if (savedKeys.length === 0) { setWords([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWords().finally(() => setLoading(false));
  }, [fetchWords]);

  const handleRemove = async (w: SavedWord) => {
    const deviceId = getDeviceId();
    setWords((prev) => prev.filter((x) => x.word !== w.word || x.article_id !== w.article_id));

    // Update localStorage
    const key = `${w.article_id}:${w.word}`;
    const saved: string[] = JSON.parse(localStorage.getItem("savedWords") ?? "[]");
    localStorage.setItem("savedWords", JSON.stringify(saved.filter((k) => k !== key)));

    // Sync to server
    fetch("/api/words/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId, articleId: w.article_id, word: w.word, action: "unsave" }),
    }).catch(() => {});
  };

  const handleSpeak = useCallback(async (w: string) => {
    setSpeaking(w);
    await speak(w, "en");
    setSpeaking(null);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0a0f1e]">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-0.5">Vocabulary</p>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-400" />
              단어장
              {words.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {words.length}개
                </span>
              )}
            </h1>
          </div>
          <button
            onClick={() => { setLoading(true); fetchWords().finally(() => setLoading(false)); }}
            className="p-2 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="새로고침"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-xs">단어를 불러오는 중…</p>
            </div>
          ) : words.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <span className="text-4xl">📖</span>
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">저장한 단어가 없어요</p>
                <p className="text-slate-600 text-xs leading-relaxed">
                  뉴스 탭에서 기사를 읽고<br />
                  <Star size={11} className="inline mb-0.5" /> 저장 버튼으로 단어를 모아보세요
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-8">
              {words.map((w) => (
                <WordCard
                  key={`${w.article_id}:${w.word}`}
                  {...w}
                  onRemove={() => handleRemove(w)}
                  speakingWord={speakingWord}
                  onSpeak={handleSpeak}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
