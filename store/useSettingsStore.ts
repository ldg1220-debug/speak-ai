import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsStore {
  // Volume (0–1)
  volume: number;
  // Feature 1: Korean → English phrase suggestion
  koreanToEnglish: boolean;
  // Feature 2: Korean summary after English reply
  showKoreanSummary: boolean;
  // Feature 5: Hands-free / continuous mode
  continuousMode: boolean;

  setVolume: (v: number) => void;
  toggleKoreanToEnglish: () => void;
  toggleKoreanSummary: () => void;
  toggleContinuousMode: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      volume: 1,
      koreanToEnglish: true,
      showKoreanSummary: true,
      continuousMode: false,

      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      toggleKoreanToEnglish: () => set((s) => ({ koreanToEnglish: !s.koreanToEnglish })),
      toggleKoreanSummary: () => set((s) => ({ showKoreanSummary: !s.showKoreanSummary })),
      toggleContinuousMode: () => set((s) => ({ continuousMode: !s.continuousMode })),
    }),
    { name: "newstalk-settings" }
  )
);
