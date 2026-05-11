"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Mic, MicOff, Loader2, History, Settings2, Send } from "lucide-react";
import { PERSONAS } from "@/lib/personas";
import { useCharacterStore, type Emotion } from "@/store/useCharacterStore";
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
import type { CharacterState } from "@/components/CharacterScene";
import { getTopicById } from "@/lib/topics";

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
    isRecording, isProcessing, isSpeaking, isGeneratingReport,
    autoStartChat,
    setPersona, setTopicId, addMessage, addHistory, resetSession,
    setIsRecording, setIsProcessing, setIsGeneratingReport, setCurrentEmotion,
    setAutoStartChat,
  } = useCharacterStore();

  const [step, setStep]               = useState<Step>("tutor");
  const [textInput, setTextInput]     = useState("");
  const [showReport, setShowReport]   = useState(false);
  const [reportData, setReportData]   = useState<SessionReportData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions]       = useState<StoredSession[]>([]);

  const { playAudio, amplitudeRef } = useAudioAnalyzer();
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const chatEndRef        = useRef<HTMLDivElement | null>(null);
  const textInputRef      = useRef<HTMLTextAreaElement>(null);

  const characterState: CharacterState =
    isSpeaking   ? "speaking"  :
    isProcessing ? "thinking"  :
    isRecording  ? "listening" : "idle";

  const disabled         = isProcessing || isSpeaking || isGeneratingReport;
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

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isProcessing || isRecording || isSpeaking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [isProcessing, isRecording, isSpeaking, setIsRecording]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.onstop = async () => {
      const mimeType = mediaRecorderRef.current?.mimeType ?? "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (blob.size >= 1000) await sendAudio(blob, mimeType);
    };
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, setIsRecording]);

  // ── Send audio (voice) ─────────────────────────────────────────────────────

  const sendAudio = async (blob: Blob, mimeType: string) => {
    setIsProcessing(true);
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      fd.append("history", JSON.stringify(history));
      fd.append("personaId", personaId);
      if (topicId) fd.append("topicId", topicId);
      if (newsContext) fd.append("newsArticle", JSON.stringify(newsContext));

      const res = await fetch("/api/chat", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const data: {
        transcript: string;
        correction: string | null;
        reply: string;
        audio: string;
        emotion: Emotion;
        pronunciationScore: number | null;
        language: string;
      } = await res.json();

      addMessage({ role: "user", text: data.transcript, correction: data.correction, pronunciationScore: data.pronunciationScore });
      addMessage({ role: "assistant", text: data.reply, emotion: data.emotion ?? "neutral" });
      addHistory({ role: "user",      content: data.transcript });
      addHistory({ role: "assistant", content: data.reply });
      setCurrentEmotion(data.emotion ?? "neutral");
      setIsProcessing(false);

      if (data.audio) {
        const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
        await playAudio(bytes.buffer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addMessage({ role: "assistant", text: `⚠️ ${msg}` });
      setIsProcessing(false);
    }
  };

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
        body: JSON.stringify({ text, history, personaId, topicId, newsArticle: newsContext }),
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
        await playAudio(bytes.buffer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addMessage({ role: "assistant", text: `⚠️ ${msg}` });
      setIsProcessing(false);
    }
  }, [textInput, disabled, history, personaId, topicId, newsContext, addMessage, addHistory, setIsProcessing, setCurrentEmotion, playAudio]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRecording();
  };
  const handlePointerUp = () => stopRecording();

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
          amplitudeRef={amplitudeRef}
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
            disabled={disabled}
            placeholder={
              isRecording   ? "🔴 손 떼면 전송…" :
              isProcessing  ? "Processing…"       :
              isSpeaking    ? "Speaking…"          :
              "메시지 입력 또는 꾹 눌러서 말하기…"
            }
            rows={1}
            style={{ height: 46, maxHeight: 120 }}
            className="flex-1 bg-slate-800/80 text-slate-100 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600 border border-slate-700/50 disabled:opacity-50 leading-snug overflow-y-auto"
          />

          {/* Send (text) or Mic (voice) button */}
          {textInput.trim() ? (
            <button
              onClick={sendText}
              disabled={disabled}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40 shadow-md"
            >
              <Send size={18} className="text-white" />
            </button>
          ) : (
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              disabled={disabled}
              aria-label={isRecording ? "Stop recording" : "Hold to speak"}
              className={[
                "relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-150 select-none",
                "focus:outline-none",
                disabled
                  ? "bg-slate-800 cursor-not-allowed opacity-40"
                  : isRecording
                    ? "bg-red-600 scale-110 shadow-lg shadow-red-600/40 pulse-ring"
                    : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md",
              ].join(" ")}
            >
              {isProcessing || isSpeaking || isGeneratingReport
                ? <Loader2 size={18} className="text-white animate-spin" />
                : isRecording
                  ? <MicOff size={18} className="text-white" />
                  : <Mic size={18} className="text-white" />}
            </button>
          )}
        </div>

        {/* Hint text */}
        <p className="text-[10px] text-slate-700 text-center mt-2">
          {isRecording ? "손 떼면 전송" : "Enter로 전송 · 마이크 홀드해서 말하기"}
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

    </div>
  );
}
