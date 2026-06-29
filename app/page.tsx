"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Mic, MicOff, Loader2, History, Settings2, Send, SlidersHorizontal } from "lucide-react";
import { PERSONAS } from "@/lib/personas";
import { useCharacterStore, type Emotion } from "@/store/useCharacterStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGeminiLiveSession } from "@/hooks/useGeminiLiveSession";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import {
  loadSessions,
  saveSession,
  deleteSession,
  calcAvgPronunciation,
  type StoredSession,
  type SessionReportData,
  type StoredMessage,
} from "@/lib/storage";
import TutorStep     from "@/components/TutorStep";
import TopicStep     from "@/components/TopicStep";
import SessionReport from "@/components/SessionReport";
import HistoryDrawer from "@/components/HistoryDrawer";
import SettingsPanel from "@/components/SettingsPanel";
import type { CharacterState } from "@/components/CharacterScene";
import { getTopicById } from "@/lib/topics";
import { loadMemory, saveMemory, mergeMemory, type UserMemory } from "@/lib/userMemory";

const CharacterScene = dynamic(() => import("@/components/CharacterScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-300 to-sky-100">
      <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    </div>
  ),
});

type Step = "tutor" | "topic" | "chat";

// ─── Pronunciation badge ──────────────────────────────────────────────────────

function PronBadge({ score }: { score: number }) {
  const [color, label] =
    score >= 80 ? ["text-emerald-400 bg-emerald-400/10 border-emerald-400/25", "Excellent"] :
    score >= 60 ? ["text-amber-400  bg-amber-400/10  border-amber-400/25",  "Good"]      :
    score >= 40 ? ["text-orange-400 bg-orange-400/10 border-orange-400/25", "Fair"]      :
                  ["text-red-400    bg-red-400/10    border-red-400/25",    "Needs work"];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${color}`}>
      🎙 {score}% · {label}
    </span>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-1 py-0.5">
      {[0, 160, 320].map((d) => (
        <span
          key={d}
          className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const {
    personaId, topicId, newsContext, sessionId, sessionStart,
    messages, history,
    isProcessing, isSpeaking, isGeneratingReport,
    autoStartChat,
    setPersona, setTopicId, addMessage, addHistory, resetSession,
    setIsProcessing, setIsGeneratingReport, setCurrentEmotion,
    setAutoStartChat,
  } = useCharacterStore();

  const [step, setStep]               = useState<Step>("tutor");
  const [textInput, setTextInput]     = useState("");
  const [showReport, setShowReport]   = useState(false);
  const [reportData, setReportData]   = useState<SessionReportData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions]       = useState<StoredSession[]>([]);
  const [userMemory, setUserMemory]   = useState<UserMemory>(() => loadMemory());

  const { volume, koreanToEnglish, showKoreanSummary } = useSettingsStore();

  const {
    connect: connectLive,
    disconnect: disconnectLive,
    isConnected: isLiveConnected,
    isAiSpeaking: isLiveAiSpeaking,
    isUserSpeaking: isLiveUserSpeaking,
    error: liveError,
  } = useGeminiLiveSession();

  const { playAudio } = useAudioAnalyzer();
  const dummyAmplitudeRef = useRef(0);
  const chatEndRef   = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const characterState: CharacterState =
    isLiveAiSpeaking   ? "speaking"  :
    isProcessing       ? "thinking"  :
    isLiveUserSpeaking ? "listening" : "idle";

  const disabled = isProcessing || isSpeaking || isGeneratingReport;
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const allScores        = messages.filter((m) => m.role === "user").map((m) => m.pronunciationScore ?? null);
  const avgPron          = calcAvgPronunciation(allScores);

  useEffect(() => { setSessions(loadSessions()); }, []);

  // Auto-start chat when coming from news page
  useEffect(() => {
    if (autoStartChat) {
      setAutoStartChat(false);
      setStep("chat");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (step === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, step]);

  // ── Live voice session toggle ────────────────────────────────────────────

  const toggleLiveSession = useCallback(async () => {
    if (isLiveConnected) {
      disconnectLive();
      return;
    }
    await connectLive({
      personaId,
      topicId,
      newsArticle: newsContext,
      userMemory,
      koreanToEnglish,
      showKoreanSummary,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveConnected, connectLive, disconnectLive, personaId, topicId, newsContext, userMemory, koreanToEnglish, showKoreanSummary]);

  useEffect(() => {
    if (liveError) addMessage({ role: "assistant", text: `⚠️ ${liveError}` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveError]);

  useEffect(() => () => disconnectLive(), [disconnectLive]);

  // ── Send text (keyboard) ───────────────────────────────────────────────────

  const sendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || disabled) return;
    setTextInput("");
    if (textInputRef.current) {
      textInputRef.current.style.height = "auto";
    }

    // Add user message immediately
    addMessage({ role: "user", text, correction: null, pronunciationScore: null });
    addHistory({ role: "user", content: text });
    setIsProcessing(true);

    try {
      const res = await fetch("/api/chat/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, personaId, topicId, newsArticle: newsContext, koreanToEnglish, showKoreanSummary, userMemory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const data: {
        reply: string;
        correction: string | null;
        emotion: Emotion;
        audio: string;
      } = await res.json();

      addMessage({ role: "assistant", text: data.reply, emotion: data.emotion ?? "neutral" });
      addHistory({ role: "assistant", content: data.reply });
      setCurrentEmotion(data.emotion ?? "neutral");
      setIsProcessing(false);

      if (data.audio) {
        const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
        await playAudio(bytes.buffer, volume);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addMessage({ role: "assistant", text: `⚠️ ${msg}` });
      setIsProcessing(false);
    }
  }, [textInput, disabled, history, personaId, topicId, newsContext, koreanToEnglish, showKoreanSummary, volume, addMessage, addHistory, setIsProcessing, setCurrentEmotion, playAudio]);

  // ── Session report ─────────────────────────────────────────────────────────

  const handleEndSession = useCallback(async () => {
    if (userMessageCount === 0) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role, text: m.text,
            correction: m.role === "user" ? m.correction : null,
            pronunciationScore: m.role === "user" ? m.pronunciationScore : null,
          })),
          personaId, topicId,
        }),
      });
      const report: SessionReportData = await res.json();
      setReportData(report);
      setShowReport(true);

      const storedMsgs: StoredMessage[] = messages.map((m) => ({
        role: m.role, text: m.text,
        correction: m.role === "user" ? (m.correction ?? null) : null,
        pronunciationScore: m.role === "user" ? (m.pronunciationScore ?? null) : null,
        timestamp: new Date().toISOString(),
      }));
      const scores = messages.filter((m) => m.role === "user").map((m) => m.pronunciationScore ?? null);
      const stored: StoredSession = {
        id: sessionId, personaId, topicId,
        startedAt: sessionStart, endedAt: new Date().toISOString(),
        messageCount: userMessageCount, messages: storedMsgs,
        avgPronunciationScore: calcAvgPronunciation(scores), report,
      };
      saveSession(stored);
      setSessions(loadSessions());

      // Extract new memory facts from this session (fire-and-forget, non-blocking)
      const currentMemory = loadMemory();
      fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, text: m.text })),
          existingMemory: currentMemory,
        }),
      })
        .then((r) => r.json())
        .then((patch: Partial<UserMemory>) => {
          const updated = mergeMemory(currentMemory, {
            ...patch,
            totalSessions: currentMemory.totalSessions + 1,
          });
          saveMemory(updated);
          setUserMemory(updated);
        })
        .catch(() => {
          // memory extraction failed — just increment session count
          const updated = mergeMemory(currentMemory, { totalSessions: currentMemory.totalSessions + 1 });
          saveMemory(updated);
          setUserMemory(updated);
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate report.";
      alert(`Report error: ${msg}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [messages, userMessageCount, personaId, topicId, sessionId, sessionStart, setIsGeneratingReport]);

  function startNewSession() {
    setShowReport(false);
    setReportData(null);
    setTextInput("");
    resetSession();
    setStep("tutor");
  }

  function handleDeleteSession(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  // ─── Step: Tutor Selection ─────────────────────────────────────────────────

  if (step === "tutor") {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <TutorStep
          selected={personaId}
          onSelect={(id) => setPersona(id)}
          onNext={() => setStep("topic")}
        />
      </div>
    );
  }

  // ─── Step: Topic Selection ─────────────────────────────────────────────────

  if (step === "topic") {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <TopicStep
          personaId={personaId}
          topicId={topicId}
          onSelectTopic={setTopicId}
          onBack={() => setStep("tutor")}
          onStart={() => {
            resetSession();
            setStep("chat");
          }}
        />
      </div>
    );
  }

  // ─── Step: Chat ────────────────────────────────────────────────────────────

  const currentTopic = getTopicById(topicId);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-[#0a0f1e] fade-up">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0">
            {PERSONAS[personaId].emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-white leading-tight">{PERSONAS[personaId].name}</p>
              {currentTopic && (
                <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                  {currentTopic.emoji} {currentTopic.nameKo}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-none">
              {PERSONAS[personaId].roleKo}
              {avgPron !== null && <span className="text-slate-600"> · avg {avgPron}%</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="relative p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="대화 기록"
          >
            <History size={15} />
            {sessions.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {sessions.length > 9 ? "9+" : sessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="설정"
          >
            <SlidersHorizontal size={15} />
          </button>
          <button
            onClick={startNewSession}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="튜터/주제 변경"
          >
            <Settings2 size={14} />
          </button>
        </div>
      </header>

      {/* ── Character Scene ── */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: 240 }}>
        <CharacterScene
          personaId={personaId}
          characterState={characterState}
          amplitudeRef={dummyAmplitudeRef}
        />

        {/* State badge — top left */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className={[
            "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm",
            characterState === "speaking"  ? "bg-indigo-600/85 text-white" :
            characterState === "listening" ? "bg-red-500/85 text-white"    :
            characterState === "thinking"  ? "bg-amber-500/85 text-white"  :
            "bg-slate-900/70 text-slate-400",
          ].join(" ")}>
            {characterState === "speaking"  ? <><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Speaking</>  :
             characterState === "listening" ? <><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Listening</> :
             characterState === "thinking"  ? <>💭 Thinking…</> :
             <>● Idle</>}
          </span>
        </div>

        {/* Report button — top right */}
        {userMessageCount > 0 && (
          <div className="absolute top-3 right-3">
            <button
              onClick={handleEndSession}
              disabled={disabled || isGeneratingReport}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-400 hover:text-red-400 hover:bg-slate-900/95 text-[10px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm border border-slate-700/50"
            >
              {isGeneratingReport ? <Loader2 size={10} className="animate-spin" /> : "■"}
              {isGeneratingReport ? "분석중…" : "리포트"}
            </button>
          </div>
        )}
      </div>

      {/* ── Chat messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {messages.map((msg, i) => (
          <div key={msg.id ?? i} className={`flex flex-col gap-1.5 msg-in ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" ? (
              <>
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-indigo-600 text-white text-sm leading-relaxed shadow-md shadow-indigo-900/30">
                  {msg.text}
                </div>
                {/* Pronunciation badge — only for voice messages (non-null score) */}
                {msg.pronunciationScore !== null && msg.pronunciationScore !== undefined && (
                  <PronBadge score={msg.pronunciationScore} />
                )}
                {msg.correction && (
                  <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
                    <span className="font-bold text-amber-400">💡 More natural: </span>
                    {msg.correction}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-end gap-2 max-w-[85%]">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-sm mb-0.5 shadow-sm">
                  {PERSONAS[personaId].emoji}
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800 text-slate-100 text-sm leading-relaxed shadow-sm border border-slate-700/30">
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isProcessing && !isSpeaking && (
          <div className="flex items-end gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-sm mb-0.5">
              {PERSONAS[personaId].emoji}
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-800 border border-slate-700/30 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* ── Footer: Text input + Mic ── */}
      <footer className="px-4 pt-3 pb-5 border-t border-slate-800/80 bg-slate-950 shrink-0">
        <div className="flex items-end gap-2">
          {/* Text input */}
          <textarea
            ref={textInputRef}
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && textInput.trim() && !disabled) {
                e.preventDefault();
                sendText();
              }
            }}
            disabled={disabled || isLiveConnected}
            placeholder={
              isLiveConnected ? "🎙 음성 대화 중…" :
              isProcessing    ? "Processing…"       :
              isSpeaking      ? "Speaking…"          :
              "메시지 입력 또는 마이크로 음성 대화 시작…"
            }
            rows={1}
            style={{ height: 46, maxHeight: 120 }}
            className="flex-1 bg-slate-800/80 text-slate-100 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600 border border-slate-700/50 disabled:opacity-50 leading-snug overflow-y-auto"
          />

          {/* Send (text) or Mic (live voice toggle) button */}
          {textInput.trim() && !isLiveConnected ? (
            <button
              onClick={sendText}
              disabled={disabled}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40 shadow-md"
            >
              <Send size={18} className="text-white" />
            </button>
          ) : (
            <button
              onClick={toggleLiveSession}
              disabled={isProcessing || isGeneratingReport}
              aria-label={isLiveConnected ? "End voice session" : "Start voice session"}
              className={[
                "relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-150 select-none",
                "focus:outline-none",
                isProcessing || isGeneratingReport
                  ? "bg-slate-800 cursor-not-allowed opacity-40"
                  : isLiveConnected
                    ? "bg-red-600 scale-110 shadow-lg shadow-red-600/40 pulse-ring"
                    : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md",
              ].join(" ")}
            >
              {isLiveConnected
                ? <MicOff size={18} className="text-white" />
                : <Mic size={18} className="text-white" />}
            </button>
          )}
        </div>

        {/* Hint text */}
        <p className="text-[10px] text-slate-700 text-center mt-2">
          {isLiveConnected
            ? "🎙 실시간 음성 대화 중 · 마이크를 눌러 종료"
            : "Enter로 전송 · 마이크를 눌러 실시간 음성 대화 시작"}
        </p>
      </footer>

      {/* ── Modals ── */}
      {showReport && reportData && (
        <SessionReport
          report={reportData}
          messageCount={userMessageCount}
          avgPronunciation={avgPron}
          onClose={() => setShowReport(false)}
          onNewSession={startNewSession}
        />
      )}
      {showHistory && (
        <HistoryDrawer
          sessions={sessions}
          onClose={() => setShowHistory(false)}
          onDelete={handleDeleteSession}
        />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

    </div>
  );
}
