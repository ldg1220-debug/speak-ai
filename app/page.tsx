"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Volume2, BookOpen, Loader2 } from "lucide-react";

type HistoryMessage = { role: "user" | "assistant"; content: string };

type Message =
  | { role: "user"; text: string; correction: string | null }
  | { role: "assistant"; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hey! I'm Kai, your English conversation partner. Hold the mic and start talking — any topic, any time. 😊 What's been on your mind lately?" },
  ]);
  // GPT-4o conversation history (only role+content, not UI-specific fields)
  const [history, setHistory] = useState<HistoryMessage[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const startRecording = useCallback(async () => {
    if (isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [isProcessing]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.onstop = async () => {
      const mimeType = mediaRecorderRef.current?.mimeType ?? "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      await sendAudio(audioBlob, mimeType);
    };
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendAudio = async (audioBlob: Blob, mimeType: string) => {
    if (audioBlob.size < 1000) return;
    setIsProcessing(true);
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `recording.${ext}`);
      formData.append("history", JSON.stringify(history));

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const data: { transcript: string; correction: string | null; reply: string; audio: string } =
        await res.json();

      // Update UI messages
      setMessages((prev) => [
        ...prev,
        { role: "user", text: data.transcript, correction: data.correction },
        { role: "assistant", text: data.reply },
      ]);

      // Append to GPT-4o history
      setHistory((prev) => [
        ...prev,
        { role: "user", content: data.transcript },
        { role: "assistant", content: data.reply },
      ]);

      // Auto-play TTS
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          audioRef.current.onended = () => URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `⚠️ ${message}` },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRecording();
  };
  const handlePointerUp = () => stopRecording();

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60 bg-slate-900/90 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600">
          <BookOpen size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-100 leading-tight">English Tutor AI</h1>
          <p className="text-xs text-slate-400">Talk about anything · Korean &amp; English OK</p>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
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
                <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 mt-0.5">
                  <Volume2 size={13} className="text-indigo-400" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-slate-800 text-slate-100 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-700">
              <Loader2 size={13} className="text-indigo-400 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-slate-800 text-slate-400 text-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* Footer */}
      <footer className="px-4 py-5 border-t border-slate-700/60 bg-slate-900/90 backdrop-blur">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500">
            {isRecording ? "Release to send" : isProcessing ? "Processing…" : "Hold to speak · 한국어도 OK"}
          </p>
          <div className="relative flex items-center justify-center">
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              disabled={isProcessing}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className={[
                "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 select-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                isProcessing
                  ? "bg-slate-700 cursor-not-allowed opacity-50"
                  : isRecording
                  ? "bg-red-600 scale-110 shadow-lg shadow-red-600/40 pulse-ring"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95",
              ].join(" ")}
            >
              {isProcessing ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : isRecording ? (
                <MicOff size={24} className="text-white" />
              ) : (
                <Mic size={24} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </footer>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
