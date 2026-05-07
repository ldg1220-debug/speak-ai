"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Mic, MicOff, BookOpen, Loader2, RotateCcw } from "lucide-react";
import { PERSONAS, DEFAULT_PERSONA, PersonaId } from "@/lib/personas";
import PersonaSelector from "@/components/PersonaSelector";
import type { CharacterState } from "@/components/CharacterScene";

// SSR-safe: Three.js / Canvas cannot run on the server
const CharacterScene = dynamic(() => import("@/components/CharacterScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
      Loading…
    </div>
  ),
});

// ─── Types ───────────────────────────────────────────────────────────────────

type HistoryEntry = { role: "user" | "assistant"; content: string };

type Message =
  | { role: "user"; text: string; correction: string | null }
  | { role: "assistant"; text: string };

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const [personaId, setPersonaId]           = useState<PersonaId>(DEFAULT_PERSONA);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [history, setHistory]               = useState<HistoryEntry[]>([]);
  const [isRecording, setIsRecording]       = useState(false);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [isSpeaking, setIsSpeaking]         = useState(false);

  // Derived character state for the 3D avatar
  const characterState: CharacterState =
    isSpeaking   ? "speaking"  :
    isProcessing ? "thinking"  :
    isRecording  ? "listening" : "idle";

  // Refs — not state, so they don't cause re-renders
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef      = useRef<Blob[]>([]);
  const audioRef            = useRef<HTMLAudioElement | null>(null);
  const chatEndRef          = useRef<HTMLDivElement | null>(null);
  const amplitudeRef        = useRef(0);                       // read by CharacterScene
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const ampRafRef           = useRef<number | null>(null);
  const audioSourceReady    = useRef(false);

  // Init greeting on persona change
  useEffect(() => {
    const p = PERSONAS[personaId];
    setMessages([{ role: "assistant", text: p.greeting }]);
    setHistory([]);
  }, [personaId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // ── Audio amplitude tracking ──────────────────────────────────────────────

  function initAudioContext() {
    if (!audioRef.current || audioSourceReady.current) return;
    try {
      audioCtxRef.current  = new AudioContext();
      analyserRef.current  = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const src = audioCtxRef.current.createMediaElementSource(audioRef.current);
      src.connect(analyserRef.current);
      analyserRef.current.connect(audioCtxRef.current.destination);
      audioSourceReady.current = true;
    } catch (e) {
      console.warn("AudioContext init failed:", e);
    }
  }

  function startAmplitude() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    function tick() {
      analyserRef.current!.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      amplitudeRef.current = avg / 128;
      ampRafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopAmplitude() {
    if (ampRafRef.current) cancelAnimationFrame(ampRafRef.current);
    ampRafRef.current = null;
    amplitudeRef.current = 0;
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isProcessing || isRecording) return;
    // Set up AudioContext on first user gesture
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
  }, [isProcessing, isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── API call ──────────────────────────────────────────────────────────────

  const sendAudio = async (blob: Blob, mimeType: string) => {
    setIsProcessing(true);
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      fd.append("history", JSON.stringify(history));
      fd.append("personaId", personaId);

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
      } = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "user", text: data.transcript, correction: data.correction },
        { role: "assistant", text: data.reply },
      ]);
      setHistory((prev) => [
        ...prev,
        { role: "user", content: data.transcript },
        { role: "assistant", content: data.reply },
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
        return; // don't run the finally setIsProcessing(false) twice
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    }
    setIsProcessing(false);
  };

  // ── Persona switch ────────────────────────────────────────────────────────

  function handlePersonaSelect(id: PersonaId) {
    if (id === personaId) return;
    stopAmplitude();
    setIsSpeaking(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setPersonaId(id);
  }

  // ── Pointer handlers (hold to speak) ─────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRecording();
  };
  const handlePointerUp = () => stopRecording();

  // ─── Render ────────────────────────────────────────────────────────────────

  const disabled = isProcessing || isSpeaking;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-900/90 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600">
          <BookOpen size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-100 leading-tight">English Tutor AI</h1>
          <p className="text-[11px] text-slate-500 truncate">
            {PERSONAS[personaId].name} · {PERSONAS[personaId].roleKo}
          </p>
        </div>
        <button
          onClick={() => handlePersonaSelect(personaId)}
          title="Reset conversation"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </header>

      {/* ── Persona selector ── */}
      <PersonaSelector current={personaId} onSelect={handlePersonaSelect} />

      {/* ── 3D Character viewport ── */}
      <div className="h-52 shrink-0 relative overflow-hidden">
        <CharacterScene
          personaId={personaId}
          characterState={characterState}
          amplitudeRef={amplitudeRef}
        />
        {/* State label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <span className={[
            "text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide uppercase",
            characterState === "speaking"  ? "bg-indigo-600/80 text-white" :
            characterState === "listening" ? "bg-red-600/80 text-white" :
            characterState === "thinking"  ? "bg-amber-600/80 text-white" :
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
              <span className="inline-flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="animate-bounce" style={{ animationDelay: `${d}ms` }}>·</span>
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* ── Footer / mic control ── */}
      <footer className="px-4 py-4 border-t border-slate-700/60 bg-slate-900/90 backdrop-blur shrink-0">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] text-slate-500">
            {isRecording  ? "Release to send"   :
             isProcessing ? "Processing…"        :
             isSpeaking   ? `${PERSONAS[personaId].name} is speaking…` :
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
            {isProcessing || isSpeaking ? (
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
    </div>
  );
}
