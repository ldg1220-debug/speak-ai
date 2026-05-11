import { create } from "zustand";
import { type PersonaId, DEFAULT_PERSONA, PERSONAS } from "@/lib/personas";
import type { Article } from "@/lib/mockArticles";

export type Emotion = "neutral" | "happy" | "sad" | "surprised" | "thinking";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  correction?: string | null;
  pronunciationScore?: number | null;
  emotion?: Emotion;
  timestamp: Date;
}

export type HistoryEntry = { role: "user" | "assistant"; content: string };

interface CharacterStore {
  // Session
  personaId: PersonaId;
  topicId: string | null;
  newsContext: Article | null;
  sessionId: string;
  sessionStart: string;
  messages: Message[];
  history: HistoryEntry[];
  // UI state
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isGeneratingReport: boolean;
  currentEmotion: Emotion;
  audioVolume: number;
  // Navigation flag: skip tutor/topic steps and go straight to chat
  autoStartChat: boolean;
  // Actions
  setPersona: (id: PersonaId) => void;
  setTopicId: (id: string | null) => void;
  setNewsContext: (article: Article | null) => void;
  addMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  addHistory: (entry: HistoryEntry) => void;
  resetSession: () => void;
  setIsRecording: (val: boolean) => void;
  setIsProcessing: (val: boolean) => void;
  setIsSpeaking: (val: boolean) => void;
  setIsGeneratingReport: (val: boolean) => void;
  setCurrentEmotion: (emotion: Emotion) => void;
  setAudioVolume: (volume: number) => void;
  setAutoStartChat: (val: boolean) => void;
}

function makeWelcomeMessage(personaId: PersonaId): Message {
  return {
    id: "welcome",
    role: "assistant",
    text: PERSONAS[personaId].greeting,
    emotion: "happy",
    timestamp: new Date(),
  };
}

function newSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  personaId: DEFAULT_PERSONA,
  topicId: null,
  newsContext: null,
  sessionId: newSessionId(),
  sessionStart: new Date().toISOString(),
  messages: [makeWelcomeMessage(DEFAULT_PERSONA)],
  history: [],
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,
  isGeneratingReport: false,
  currentEmotion: "neutral",
  audioVolume: 0,
  autoStartChat: false,

  setPersona: (id) =>
    set({
      personaId: id,
      sessionId: newSessionId(),
      sessionStart: new Date().toISOString(),
      messages: [makeWelcomeMessage(id)],
      history: [],
      currentEmotion: "neutral",
      isRecording: false,
      isProcessing: false,
      isSpeaking: false,
    }),

  setTopicId: (id) => set({ topicId: id }),
  setNewsContext: (article) => set({ newsContext: article }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),

  addHistory: (entry) =>
    set((state) => ({ history: [...state.history, entry] })),

  resetSession: () =>
    set((state) => ({
      sessionId: newSessionId(),
      sessionStart: new Date().toISOString(),
      messages: [makeWelcomeMessage(state.personaId)],
      history: [],
      currentEmotion: "neutral",
      isRecording: false,
      isProcessing: false,
      isSpeaking: false,
    })),

  setIsRecording: (val) => set({ isRecording: val }),
  setIsProcessing: (val) => set({ isProcessing: val }),
  setIsSpeaking: (val) => set({ isSpeaking: val }),
  setIsGeneratingReport: (val) => set({ isGeneratingReport: val }),
  setCurrentEmotion: (emotion) => set({ currentEmotion: emotion }),
  setAudioVolume: (volume) => set({ audioVolume: volume }),
  setAutoStartChat: (val) => set({ autoStartChat: val }),
}));
