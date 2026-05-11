"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, BookOpen, CheckCircle, Volume2, Star,
  ChevronLeft, Mic, RotateCcw,
} from "lucide-react";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { Article } from "@/lib/mockArticles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category   = "all" | "world" | "korea" | "entertainment" | "business" | "tech";
type Difficulty = "beginner" | "intermediate" | "advanced";

const CATEGORY_LABELS: Record<Category, { label: string; emoji: string }> = {
  all:           { label: "전체",     emoji: "🌐" },
  world:         { label: "세계",     emoji: "🌍" },
  korea:         { label: "한국",     emoji: "🇰🇷" },
  entertainment: { label: "연예",     emoji: "🎬" },
  business:      { label: "비즈니스", emoji: "💼" },
  tech:          { label: "기술",     emoji: "💻" },
};

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string }> = {
  beginner:     { label: "입문", color: "text-emerald-400", bg: "bg-emerald-500" },
  intermediate: { label: "중급", color: "text-amber-400",   bg: "bg-amber-500"   },
  advanced:     { label: "고급", color: "text-red-400",     bg: "bg-red-500"     },
};

const LEVEL_BADGE: Record<string, string> = {
  beginner:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  intermediate: "text-amber-400   bg-amber-400/10   border-amber-400/20",
  advanced:     "text-red-400     bg-red-400/10     border-red-400/20",
};

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("newstalk_device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("newstalk_device_id", id); }
  return id;
}

function speak(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = lang === "ko-KR" ? 0.95 : 0.9;
  window.speechSynthesis.speak(u);
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({
  article, selected, learned, onClick,
}: {
  article: Article; selected: boolean; learned: boolean; onClick: () => void;
}) {
  const levelCls = LEVEL_BADGE[article.level] ?? "text-slate-400 bg-slate-700 border-slate-600";
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-3.5 rounded-2xl border transition-all duration-150",
        selected
          ? "border-indigo-500/70 bg-indigo-600/10 shadow-sm shadow-indigo-900/30"
          : "border-slate-700/40 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-600/60",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${levelCls}`}>
          {DIFFICULTY_CONFIG[article.level as Difficulty]?.label ?? article.level}
        </span>
        <span className="text-[10px] text-slate-600">
          {article.source}
        </span>
        {learned && (
          <span className="ml-auto text-emerald-400 flex items-center gap-0.5 text-[10px] font-medium">
            <CheckCircle size={10} /> 완료
          </span>
        )}
      </div>
      <p className={[
        "text-sm font-medium leading-snug line-clamp-2",
        selected ? "text-white" : "text-slate-200",
      ].join(" ")}>
        {article.title}
      </p>
    </button>
  );
}

// ─── Vocabulary Card ──────────────────────────────────────────────────────────

function VocabCard({
  word, meaning, pos, example, saved, onSave,
}: {
  word: string; meaning: string; pos: string; example: string;
  saved: boolean; onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-sm">{word}</span>
          <span className="text-[10px] text-slate-600 font-medium bg-slate-700/60 px-1.5 py-0.5 rounded">{pos}</span>
          <button
            onClick={() => speak(word, "en-US")}
            className="text-slate-600 hover:text-indigo-400 transition-colors"
            title="발음 듣기"
          >
            <Volume2 size={12} />
          </button>
        </div>
        <button
          onClick={onSave}
          className={[
            "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
            saved
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
              : "bg-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700",
          ].join(" ")}
        >
          <Star size={9} className={saved ? "fill-current" : ""} />
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      <p className="text-sm text-slate-300 font-medium">{meaning}</p>
      <p className="text-xs text-slate-500 italic leading-relaxed">{example}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const router = useRouter();
  const { setNewsContext, resetSession, setAutoStartChat } = useCharacterStore();

  const [articles, setArticles]     = useState<Article[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory]     = useState<Category>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [loading, setLoading]       = useState(true);
  const [analyzing, setAnalyzing]   = useState(false);
  // Mobile: "list" | "detail"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [learned, setLearned] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    return new Set(JSON.parse(localStorage.getItem("learnedArticles") ?? "[]"));
  });
  const [savedWords, setSavedWords] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    return new Set(JSON.parse(localStorage.getItem("savedWords") ?? "[]"));
  });

  const selected = articles.find((a) => a.id === selectedId) ?? null;

  // ── Load news ──────────────────────────────────────────────────────────────
  const loadNews = useCallback(async (cat: Category) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/news/today?category=${encodeURIComponent(cat)}`);
      const data = await res.json() as { articles: Article[] };
      if (data.articles?.length > 0) {
        setArticles(data.articles);
        setSelectedId(data.articles[0].id);
      }
    } catch (err) {
      console.error("[loadNews]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNews(category); }, [category, loadNews]);

  // ── Analyze article ────────────────────────────────────────────────────────
  const analyzeArticle = useCallback(async (article: Article, diff: Difficulty) => {
    if (!article) return;
    setAnalyzing(true);
    try {
      const res      = await fetch("/api/articles/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ article, difficulty: diff }),
      });
      const analysis = await res.json() as Partial<Article>;
      setArticles((prev) =>
        prev.map((a) => a.id === article.id ? { ...a, ...analysis, vocabulary: undefined, ...analysis } : a)
      );
    } catch (err) {
      console.error("[analyzeArticle]", err);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Re-analyze when article OR difficulty changes
  // Clear vocabulary first so the loading state shows, then re-analyze
  useEffect(() => {
    if (!selected) return;
    // Wipe existing vocabulary so the skeleton shows while re-fetching
    setArticles((prev) =>
      prev.map((a) => a.id === selected.id ? { ...a, vocabulary: [] } : a)
    );
    analyzeArticle(selected, difficulty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, difficulty]);

  // ── Persist helpers ────────────────────────────────────────────────────────
  function toggleLearned(id: string) {
    setLearned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("learnedArticles", JSON.stringify([...next]));
      return next;
    });
  }

  function toggleSaveWord(key: string, article: Article, word: string, meaningKo: string, pos: string, example: string) {
    setSavedWords((prev) => {
      const next     = new Set(prev);
      const deviceId = getDeviceId();
      if (next.has(key)) {
        next.delete(key);
        fetch("/api/words/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId, articleId: article.id, word, action: "unsave" }),
        }).catch(() => {});
      } else {
        next.add(key);
        fetch("/api/words/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId, articleId: article.id, word, meaningKo, partOfSpeech: pos, example }),
        }).catch(() => {});
      }
      localStorage.setItem("savedWords", JSON.stringify([...next]));
      return next;
    });
  }

  // ── Start tutor — go directly to chat step ─────────────────────────────────
  function startTutor() {
    if (!selected) return;
    setNewsContext(selected);
    resetSession();
    setAutoStartChat(true);   // ← skips tutor/topic steps on "/"
    router.push("/");
  }

  function handleSelectArticle(id: string) {
    setSelectedId(id);
    setMobileView("detail");
  }

  const filtered = articles.filter((a) => {
    if (category === "all") return true;
    if (category === "world" || category === "korea")
      return a.region === category || a.category === category;
    return a.category === category;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#0a0f1e]">

      {/* ══ LEFT / LIST PANEL ══════════════════════════════════════════════════ */}
      <aside className={[
        "md:w-72 lg:w-80 shrink-0 flex flex-col border-r border-slate-800/60",
        "bg-[#0a0f1e]",
        // Mobile: full screen when in list view, hidden when in detail view
        mobileView === "detail" ? "hidden md:flex" : "flex",
      ].join(" ")}>

        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Today&apos;s News</p>
              <h2 className="text-base font-bold text-white mt-0.5">뉴스 학습</h2>
            </div>
            <button
              onClick={() => loadNews(category)}
              className="p-2 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              title="새로고침"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Category chips — horizontal scroll */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(Object.entries(CATEGORY_LABELS) as [Category, { label: string; emoji: string }][]).map(([cat, { label, emoji }]) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={[
                  "flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  category === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-800/70 text-slate-500 hover:text-slate-300 hover:bg-slate-800",
                ].join(" ")}
              >
                <span>{emoji}</span> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-xs">뉴스를 불러오는 중…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-xs text-slate-600">이 카테고리의 뉴스가 없습니다</p>
            </div>
          ) : (
            filtered.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                selected={a.id === selectedId}
                learned={learned.has(a.id)}
                onClick={() => handleSelectArticle(a.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ══ RIGHT / DETAIL PANEL ═══════════════════════════════════════════════ */}
      <main className={[
        "flex-1 min-w-0 flex flex-col overflow-hidden",
        mobileView === "list" ? "hidden md:flex" : "flex",
      ].join(" ")}>

        {/* Detail top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 bg-[#0a0f1e] shrink-0">
          {/* Back button — mobile only */}
          <button
            onClick={() => setMobileView("list")}
            className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Difficulty selector */}
          <div className="flex gap-1 bg-slate-800/50 rounded-xl p-0.5">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, { label: string; color: string; bg: string }][]).map(([level, cfg]) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  difficulty === level
                    ? `${cfg.bg} text-white shadow-sm`
                    : `${cfg.color} opacity-50 hover:opacity-80`,
                ].join(" ")}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {selected && (
              <button
                onClick={() => toggleLearned(selected.id)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  learned.has(selected.id)
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-500 hover:text-slate-300",
                ].join(" ")}
              >
                <CheckCircle size={11} />
                {learned.has(selected.id) ? "완료" : "완료 표시"}
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <span className="text-4xl">📰</span>
            <p className="text-slate-400 text-sm font-medium">왼쪽에서 기사를 선택하세요</p>
            <p className="text-slate-600 text-xs">뉴스로 영어 회화를 연습해보세요</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">

              {/* ─ Article header ─ */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_BADGE[selected.level] ?? ""}`}>
                    {DIFFICULTY_CONFIG[selected.level as Difficulty]?.label ?? selected.level}
                  </span>
                  <span className="text-[10px] text-slate-600">{selected.source}</span>
                  {analyzing && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <Loader2 size={9} className="animate-spin" /> AI 분석 중…
                    </span>
                  )}
                </div>
                <h1 className="text-base font-bold text-white leading-snug">{selected.title}</h1>
              </div>

              {/* ─ Summaries ─ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* English */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">English</span>
                    </div>
                    <button
                      onClick={() => speak(selected.summaryEn, "en-US")}
                      className="p-1.5 rounded-lg bg-slate-700/60 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                    >
                      <Volume2 size={12} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{selected.summaryEn}</p>
                </div>

                {/* Korean */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">한국어</span>
                    <button
                      onClick={() => speak(selected.summaryKo, "ko-KR")}
                      className="p-1.5 rounded-lg bg-slate-700/60 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                    >
                      <Volume2 size={12} />
                    </button>
                  </div>
                  {analyzing ? (
                    <div className="flex items-center gap-2 text-slate-500 text-xs py-3">
                      <Loader2 size={12} className="animate-spin" /> 번역 중…
                    </div>
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed">{selected.summaryKo}</p>
                  )}
                </div>
              </div>

              {/* ─ Opening question ─ */}
              {selected.openingQuestion && (
                <div className="rounded-2xl border border-indigo-500/25 bg-indigo-600/8 px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">오늘의 질문</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    <span className="text-indigo-400 font-bold text-base mr-1">"</span>
                    {selected.openingQuestion}
                    <span className="text-indigo-400 font-bold text-base ml-1">"</span>
                  </p>
                </div>
              )}

              {/* ─ Vocabulary ─ */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">핵심 단어</h2>
                    {selected.vocabulary?.length > 0 && (
                      <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
                        {selected.vocabulary.length}개
                      </span>
                    )}
                  </div>
                </div>

                {analyzing && (selected.vocabulary?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                    <Loader2 size={16} className="animate-spin" />
                    <p className="text-xs">핵심 단어를 추출하는 중…</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(selected.vocabulary ?? []).map(([word, meaning, pos, example]) => {
                      const key = `${selected.id}:${word}`;
                      return (
                        <VocabCard
                          key={key}
                          word={word}
                          meaning={meaning}
                          pos={pos}
                          example={example}
                          saved={savedWords.has(key)}
                          onSave={() => toggleSaveWord(key, selected, word, meaning, pos, example)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─ CTA ─ */}
              <div className="pb-8 space-y-2.5">
                <button
                  onClick={startTutor}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-900/40"
                >
                  <Mic size={17} />
                  이 뉴스로 AI 튜터와 회화 연습하기
                </button>
                <p className="text-center text-[11px] text-slate-600">
                  AI 튜터가 기사를 바탕으로 영어 회화를 이끌어 드립니다
                </p>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
