"use client";

import { X, Volume2, VolumeX, Languages, FileText, Mic } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";

interface Props {
  onClose: () => void;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={[
        "relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0",
        on ? "bg-indigo-500" : "bg-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
          on ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function SettingsPanel({ onClose }: Props) {
  const {
    volume, koreanToEnglish, showKoreanSummary, continuousMode,
    setVolume, toggleKoreanToEnglish, toggleKoreanSummary, toggleContinuousMode,
  } = useSettingsStore();

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="w-full max-w-sm bg-[#0f1629] border border-slate-700/60 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 pb-8 sm:pb-5 fade-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">설정</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Volume */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {volume === 0 ? <VolumeX size={16} className="text-slate-400" /> : <Volume2 size={16} className="text-indigo-400" />}
              <span className="text-sm font-semibold text-slate-200">소리 크기</span>
              <span className="ml-auto text-xs text-slate-400">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-1.5 rounded-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="border-t border-slate-700/50" />

          {/* Korean → English */}
          <div className="flex items-start gap-3">
            <Languages size={18} className="text-indigo-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">한국어 → 영어 표현</span>
                <Toggle on={koreanToEnglish} onToggle={toggleKoreanToEnglish} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                한국어로 말하면 "그 말은 영어로 ○○라고 해요"라고 알려줘요
              </p>
            </div>
          </div>

          {/* Korean Summary */}
          <div className="flex items-start gap-3">
            <FileText size={18} className="text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">한국어 요약</span>
                <Toggle on={showKoreanSummary} onToggle={toggleKoreanSummary} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                튜터 답변 뒤에 한국어로 무슨 말을 했는지 요약해줘요
              </p>
            </div>
          </div>

          {/* Continuous Mode */}
          <div className="flex items-start gap-3">
            <Mic size={18} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">핸즈프리 모드</span>
                <Toggle on={continuousMode} onToggle={toggleContinuousMode} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                말이 끊기면 자동으로 감지해서 전송해요. 운전 중 연습에 편해요 🚗
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
