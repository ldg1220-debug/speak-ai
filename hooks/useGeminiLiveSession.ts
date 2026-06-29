import { useCallback, useRef, useState } from "react";
import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { useCharacterStore, type Emotion } from "@/store/useCharacterStore";
import { REPORT_TURN_TOOL_NAME } from "@/lib/geminiLiveTools";
import { lipState, ARKIT_LIP } from "@/lib/visemeState";
import type { PersonaId } from "@/lib/personas";
import type { UserMemory } from "@/lib/userMemory";
import type { Article } from "@/lib/mockArticles";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface ConnectArgs {
  personaId: PersonaId;
  topicId: string | null;
  newsArticle: Article | null;
  userMemory: UserMemory;
  koreanToEnglish?: boolean;
  showKoreanSummary?: boolean;
}

export function useGeminiLiveSession() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const playCtxRef = useRef<AudioContext | null>(null);
  const playHeadRef = useRef(0);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const playAnimRef = useRef<number>(0);
  const pendingSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const pendingAssistantTextRef = useRef("");
  const pendingUserTextRef = useRef("");

  const addMessage = useCharacterStore((s) => s.addMessage);
  const addHistory = useCharacterStore((s) => s.addHistory);
  const setAudioVolume = useCharacterStore((s) => s.setAudioVolume);
  const setStoreIsSpeaking = useCharacterStore((s) => s.setIsSpeaking);
  const setCurrentEmotion = useCharacterStore((s) => s.setCurrentEmotion);

  const stopLipSync = useCallback(() => {
    cancelAnimationFrame(playAnimRef.current);
    setAudioVolume(0);
    setStoreIsSpeaking(false);
    lipState.speaking = false;
    for (const k of ARKIT_LIP) lipState.target[k] = 0;
  }, [setAudioVolume, setStoreIsSpeaking]);

  const ensurePlaybackGraph = useCallback(() => {
    if (!playCtxRef.current || playCtxRef.current.state === "closed") {
      playCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      playHeadRef.current = playCtxRef.current.currentTime;
      const analyser = playCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(playCtxRef.current.destination);
      playAnalyserRef.current = analyser;
    }
    return playCtxRef.current;
  }, []);

  const tickLipSync = useCallback(() => {
    const analyser = playAnalyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const vol = data.reduce((a, b) => a + b, 0) / data.length / 128;
    const amp = Math.min(vol * 2.5, 1);
    setAudioVolume(amp);
    lipState.speaking = true;
    lipState.target.jawOpen = amp * 0.65;
    lipState.target.mouthFunnel = amp * 0.18;
    playAnimRef.current = requestAnimationFrame(tickLipSync);
  }, [setAudioVolume]);

  const playAudioChunk = useCallback((base64: string) => {
    const ctx = ensurePlaybackGraph();
    const pcm = base64ToArrayBuffer(base64);
    const samples = new Int16Array(pcm);
    const float32 = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) float32[i] = samples[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(playAnalyserRef.current!);

    const startAt = Math.max(playHeadRef.current, ctx.currentTime);
    source.start(startAt);
    playHeadRef.current = startAt + buffer.duration;

    pendingSourcesRef.current.push(source);
    setIsAiSpeaking(true);
    setStoreIsSpeaking(true);
    if (!playAnimRef.current) tickLipSync();

    source.onended = () => {
      pendingSourcesRef.current = pendingSourcesRef.current.filter((s) => s !== source);
      if (pendingSourcesRef.current.length === 0) {
        setIsAiSpeaking(false);
        stopLipSync();
      }
    };
  }, [ensurePlaybackGraph, stopLipSync, tickLipSync, setStoreIsSpeaking]);

  const interruptPlayback = useCallback(() => {
    for (const s of pendingSourcesRef.current) {
      try { s.stop(); } catch {}
    }
    pendingSourcesRef.current = [];
    if (playCtxRef.current) playHeadRef.current = playCtxRef.current.currentTime;
    setIsAiSpeaking(false);
    stopLipSync();
  }, [stopLipSync]);

  const handleMessage = useCallback((msg: LiveServerMessage) => {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) interruptPlayback();

      const audioData = msg.data;
      if (audioData) playAudioChunk(audioData);

      if (sc.inputTranscription?.text) {
        pendingUserTextRef.current += sc.inputTranscription.text;
        setIsUserSpeaking(true);
      }
      if (sc.outputTranscription?.text) {
        pendingAssistantTextRef.current += sc.outputTranscription.text;
      }

      if (sc.turnComplete) {
        const userText = pendingUserTextRef.current.trim();
        const assistantText = pendingAssistantTextRef.current.trim();
        if (userText) {
          addMessage({ role: "user", text: userText });
          addHistory({ role: "user", content: userText });
        }
        if (assistantText) {
          addMessage({ role: "assistant", text: assistantText });
          addHistory({ role: "assistant", content: assistantText });
        }
        pendingUserTextRef.current = "";
        pendingAssistantTextRef.current = "";
        setIsUserSpeaking(false);
      }
    }

    if (msg.toolCall?.functionCalls) {
      for (const call of msg.toolCall.functionCalls) {
        if (call.name === REPORT_TURN_TOOL_NAME) {
          const args = call.args as { correction?: string; emotion?: Emotion };
          if (args.emotion) setCurrentEmotion(args.emotion);
          if (args.correction) {
            useCharacterStore.setState((state) => {
              const messages = [...state.messages];
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === "assistant") {
                  messages[i] = { ...messages[i], correction: args.correction };
                  break;
                }
              }
              return { messages };
            });
          }
          sessionRef.current?.sendToolResponse({
            functionResponses: { id: call.id, name: call.name, response: { ok: true } },
          });
        }
      }
    }
  }, [addMessage, addHistory, setCurrentEmotion, interruptPlayback, playAudioChunk]);

  const stopMic = useCallback(() => {
    micProcessorRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    micProcessorRef.current = null;
    micSourceRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (micCtxRef.current && micCtxRef.current.state !== "closed") {
      micCtxRef.current.close();
    }
    micCtxRef.current = null;
  }, []);

  const startMic = useCallback(async (session: Session) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    micCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    micSourceRef.current = source;

    const processor = ctx.createScriptProcessor(4096, 1, 1);
    micProcessorRef.current = processor;
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(input);
      session.sendRealtimeInput({
        audio: { data: arrayBufferToBase64(pcm), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
      });
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  }, []);

  const disconnect = useCallback(() => {
    stopMic();
    interruptPlayback();
    sessionRef.current?.close();
    sessionRef.current = null;
    setIsConnected(false);
    setIsAiSpeaking(false);
    setIsUserSpeaking(false);
  }, [stopMic, interruptPlayback]);

  const connect = useCallback(async (args: ConnectArgs) => {
    setError(null);
    try {
      const res = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session.");

      const ai = new GoogleGenAI({
        apiKey: data.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = await ai.live.connect({
        model: data.model,
        callbacks: {
          onopen: () => setIsConnected(true),
          onmessage: handleMessage,
          onerror: (e) => setError(e.message || "Connection error."),
          onclose: () => {
            setIsConnected(false);
            setIsAiSpeaking(false);
            setIsUserSpeaking(false);
          },
        },
      });
      sessionRef.current = session;
      await startMic(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
      disconnect();
    }
  }, [handleMessage, startMic, disconnect]);

  return { connect, disconnect, isConnected, isAiSpeaking, isUserSpeaking, error };
}
