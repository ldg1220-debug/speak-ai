"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Mic, MicOff, BookOpen, Loader2, RotateCcw, History, Square } from "lucide-react";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import {
  loadSessions,
  saveSession,
  deleteSession,
  generateSessionId,
  calcAvgPronunciation,
  type StoredSession,
  type SessionReportData,
  type StoredMessage,
} from "@/lib/storage";
import PersonaSelector from "@/components/PersonaSelector";
import TopicSelector   from "@/components/TopicSelector";
import SessionReport   from "@/components/SessionReport";
import HistoryDrawer   from "@/components/HistoryDrawer";
import type { CharacterState } from "@/components/CharacterScene";

const CharacterScene = dynamic(() => import("@/components/CharacterScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs">
      Loading…
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryEntry = { role: "user" | "assistant"; content: string };

type Message =
  | { role: "user"; text: string; correction: string | null; pronunciationScore: number | null }
  | { role: "assistant"; text: string };

// ─── Pronunciation pill ───────────────────────────────────────────────────────

function PronBadge({ score }: { score: number }) {
  const [color, label] =
    score >= 80 ? ["text-green-400 bg-green-400/10 border-green-400/25", "Excellent"] :
    score >= 60 ? ["text-amber-400 bg-amber-400/10 border-amber-400/25", "Good"]      :
    score >= 40 ? ["text-orange-400 bg-orange-400/10 border-orange-400/25", "Fair"]   :
                  ["text-red-400 bg-red-400/10 border-red-400/25", "Needs work"];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${color}`}>
      🎙 {score}% · {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  // ── Core state ──
  const [personaId, setPersonaId]       = useState<PersonaId>(DEFAULT_PERSONA);
  const [topicId, setTopicId]           = useState<string | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [sessionId, setSessionId]       = useState(() => generateSessionId());
  const [sessionStart]                  = useState(() => new Date().toISOString());

  // ── UI state ──
  const [isRecording, setIsRecording]           = useState(false);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [isSpeaking, setIsSpeaking]             = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReport, setShowReport]             = useState(false);
  const [reportData, setReportData]             = useState<SessionReportData | null>(null);
  const [showHistory, setShowHistory]           = useState(false);
  const [sessions, setSessions]                 = useState<StoredSession[]>([]);

  const characterState: CharacterState =
    isSpeaking   ? "speaking"  :
    isProcessing ? "thinking"  :
    isRecording  ? "listening" : "idle";

  // ── Refs ──
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const audioChunksRef     = useRef<Blob[]>([]);
  const audioRef           = useRef<HTMLAudioElement | null>(null);
  const chatEndRef         = useRef<HTMLDivElement | null>(null);
  const amplitudeRef       = useRef(0);
  const audioCtxRef        = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const ampRafRef          = useRef<number | null>(null);
  const audioSourceReady   = useRef(false);
  const sessionStartRef    = useRef(sessionStart);

  // ── Init ──
  useEffect(() => {
    setMessages([{ role: "assistant", text: PERSONAS[personaId].greeting }]);
    setHistory([]);
  }, [personaId]);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // ── AudioContext (amplitude) ──────────────────────────────────────────────

  function initAudioContext() {
    if (!audioRef.current || audioSourceReady.current) return;
    try {
      audioCtxRef.current = new AudioContext();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const src = audioCtxRef.current.createMediaElementSource(audioRef.current);
      src.connect(analyserRef.current);
      analyserRef.current.connect(audioCtxRef.current.destination);
      audioSourceReady.current = true;
    } catch (e) { console.warn("AudioContext:", e); }
  }

  function startAmplitude() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    const tick = () => {
      analyserRef.current!.getByteFrequencyData(data);
      amplitudeRef.current = data.reduce((a, b) => a + b, 0) / data.length / 128;
      ampRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopAmplitude() {
    if (ampRafRef.current) cancelAnimationFrame(ampRafRef.current);
    ampRafRef.current = null;
    amplitudeRef.current = 0;
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isProcessing || isRecording || isSpeaking) return;
    initAudioContext();
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
  }, [isProcessing, isRecording, isSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send audio & process ──────────────────────────────────────────────────

  const sendAudio = async (blob: Blob, mimeType: string) => {
    setIsProcessing(true);
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      fd.append("history", JSON.stringify(history));
      fd.append("personaId", personaId);
      if (topicId) fd.append("topicId", topicId);

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
        pronunciationScore: number | null;
        language: string;
      } = await res.json();

      const userMsg: Message = {
        role: "user",
        text: data.transcript,
        correction: data.correction,
        pronunciationScore: data.pronunciationScore,
      };
      const aiMsg: Message = { role: "assistant", text: data.reply };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setHistory((prev) => [
        ...prev,
        { role: "user",      content: data.transcript },
        { role: "assistant", content: data.reply      },
      ]);

      // Play TTS
      if (data.audio && audioRef.current) {
        const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        audioRef.current.src = url;
        audioCtxRef.current?.resume();
        setIsProcessing(false);
        setIsSpeaking(true);
        startAmplitude();
        audioRef.current.play();
        audioRef.current.onended = () => {
          stopAmplitude();
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    }
    setIsProcessing(false);
  };

  // ── Session report & save ─────────────────────────────────────────────────

  const handleEndSession = useCallback(async () => {
    const userMsgs = messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            text: m.text,
            correction: m.role === "user" ? m.correction : null,
            pronunciationScore: m.role === "user" ? m.pronunciationScore : null,
          })),
          personaId,
          topicId,
        }),
      });
      const report: SessionReportData = await res.json();
      setReportData(report);
      setShowReport(true);

      // Persist to localStorage
      const storedMsgs: StoredMessage[] = messages.map((m) => ({
        role: m.role,
        text: m.text,
        correction: m.role === "user" ? m.correction : null,
        pronunciationScore: m.role === "user" ? m.pronunciationScore : null,
        timestamp: new Date().toISOString(),
      }));
      const scores = messages
        .filter((m): m is Extract<Message, { role: "user" }> => m.role === "user")
        .map((m) => m.pronunciationScore);
      const stored: StoredSession = {
        id: sessionId,
        personaId,
        topicId,
        startedAt: sessionStartRef.current,
        endedAt: new Date().toISOString(),
        messageCount: userMsgs.length,
        messages: storedMsgs,
        avgPronunciationScore: calcAvgPronunciation(scores),
        report,
      };
      saveSession(stored);
      setSessions(loadSessions());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate report.";
      alert(`Report error: ${msg}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [messages, personaId, topicId, sessionId]);

  // ── New session ───────────────────────────────────────────────────────────

  function startNewSession() {
    setShowReport(false);
    setReportData(null);
    setSessionId(generateSessionId());
    setMessages([{ role: "assistant", text: PERSONAS[personaId].greeting }]);
    setHistory([]);
    stopAmplitude();
    setIsSpeaking(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
  }

  // ── Persona / topic switching ─────────────────────────────────────────────

  function handlePersonaSelect(id: PersonaId) {
    if (id === personaId) { startNewSession(); return; }
    stopAmplitude();
    setIsSpeaking(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setPersonaId(id);
    setSessionId(generateSessionId());
  }

  function handleTopicSelect(id: string | null) {
    setTopicId(id);
  }

  function handleDeleteSession(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  // ── Pointer (hold to speak) ───────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRecording();
  };
  const handlePointerUp = () => stopRecording();

  const disabled = isProcessing || isSpeaking || isGeneratingReport;
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const allScores = messages
    .filter((m): m is Extract<Message, { role: "user" }> => m.role === "user")
    .map((m) => m.pronunciationScore);
  const avgPron = calcAvgPronunciation(allScores);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">

      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 py-3 border-b border-slate-700/60 bg-slate-900/90 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 flex-shrink-0">
          <BookOpen size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-100 leading-tight">English Tutor AI</h1>
          <p className="text-[11px] text-slate-500 truncate">
            {PERSONAS[personaId].name}
            {topicId && ` · ${topicId}`}
            {avgPron !== null && ` · 발음 avg ${avgPron}%`}
          </p>
        </div>
        {/* History button */}
        <button
          onClick={() => setShowHistory(true)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors relative"
          title="대화 기록"
        >
          <History size={15} />
          {sessions.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
              {sessions.length > 9 ? "9+" : sessions.length}
            </span>
          )}
        </button>
        {/* End session */}
        {userMessageCount > 0 && (
          <button
            onClick={handleEndSession}
            disabled={disabled || isGeneratingReport}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-600/20 hover:text-red-400 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="세션 종료 및 리포트"
          >
            {isGeneratingReport ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Square size={11} />
            )}
            {isGeneratingReport ? "분석중…" : "리포트"}
          </button>
        )}
        {/* Reset */}
        <button
          onClick={startNewSession}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          title="새 대화"
        >
          <RotateCcw size={14} />
        </button>
      </header>

      {/* ── Persona selector ── */}
      <PersonaSelector current={personaId} onSelect={handlePersonaSelect} />

      {/* ── Topic selector ── */}
      <TopicSelector current={topicId} onSelect={handleTopicSelect} />

      {/* ── 3D Character ── */}
      <div className="h-44 shrink-0 relative overflow-hidden">
        <CharacterScene
          personaId={personaId}
          characterState={characterState}
          amplitudeRef={amplitudeRef}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <span className={[
            "text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide uppercase",
            characterState === "speaking"  ? "bg-indigo-600/80 text-white" :
            characterState === "listening" ? "bg-red-600/80 text-white"    :
            characterState === "thinking"  ? "bg-amber-600/80 text-white"  :
            "bg-slate-700/60 text-slate-400",
          ].join(" ")}>
            {characterState === "speaking"  ? "Speaking"  :
             characterState === "listening" ? "Listening" :
             characterState === "thinking"  ? "Thinking…" : "Idle"}
          </span>
        </div>
      </div>

      {/* ── Chat messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" ? (
              <>
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-indigo-600 text-white text-sm leading-relaxed">
                  {msg.text}
                </div>
                {/* Pronunciation score */}
                {msg.pronunciationScore !== null && (
                  <PronBadge score={msg.pronunciationScore} />
                )}
                {/* Grammar correction */}
                {msg.correction && (
                  <div className="max-w-[80%] px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                    <span className="font-semibold text-amber-400">💡 More natural: </span>
                    {msg.correction}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2.5 max-w-[85%]">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center mt-0.5 text-xs">
                  {PERSONAS[personaId].emoji}
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-slate-800 text-slate-100 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {(isProcessing && !isSpeaking) && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
              {PERSONAS[personaId].emoji}
            </div>
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-slate-800 text-slate-400 text-sm">
              {[0, 150, 300].map((d) => (
                <span key={d} className="animate-bounce inline-block mx-0.5" style={{ animationDelay: `${d}ms` }}>·</span>
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* ── Footer / mic ── */}
      <footer className="px-4 py-4 border-t border-slate-700/60 bg-slate-900/90 backdrop-blur shrink-0">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] text-slate-500">
            {isRecording        ? "Release to send"   :
             isGeneratingReport ? "리포트 생성중…"     :
             isProcessing       ? "Processing…"        :
             isSpeaking         ? `${PERSONAS[personaId].name} is speaking…` :
             "Hold to speak · 한국어도 OK"}
          </p>
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            disabled={disabled}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            className={[
              "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 select-none",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
              disabled     ? "bg-slate-700 cursor-not-allowed opacity-40" :
              isRecording  ? "bg-red-600 scale-110 shadow-lg shadow-red-600/40 pulse-ring" :
                             "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95",
            ].join(" ")}
          >
            {isProcessing || isSpeaking || isGeneratingReport ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : isRecording ? (
              <MicOff size={24} className="text-white" />
            ) : (
              <Mic size={24} className="text-white" />
            )}
          </button>
        </div>
      </footer>

      <audio ref={audioRef} className="hidden" />

      {/* ── Session Report modal ── */}
      {showReport && reportData && (
        <SessionReport
          report={reportData}
          messageCount={userMessageCount}
          avgPronunciation={avgPron}
          onClose={() => setShowReport(false)}
          onNewSession={startNewSession}
        />
      )}

      {/* ── History drawer ── */}
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
