"use client";

import { ChevronLeft, Sparkles } from "lucide-react";
import { PERSONAS, PersonaId } from "@/lib/personas";
import { TOPICS } from "@/lib/topics";

// Persona accent colors for the Start button
const PERSONA_BTN: Record<PersonaId, { bg: string; shadow: string }> = {
  sunny:    { bg: "bg-amber-500",  shadow: "shadow-amber-950/50"  },
  aria:     { bg: "bg-violet-600", shadow: "shadow-violet-950/50" },
  kai:      { bg: "bg-sky-600",    shadow: "shadow-sky-950/50"    },
  sterling: { bg: "bg-slate-500",  shadow: "shadow-slate-950/50"  },
};

// Short Korean descriptions for each topic
const TOPIC_DESC: Record<string, string> = {
  daily:         "루틴 · 취미 · 일상 이야기",
  travel:        "여행 계획 · 명소 · 숙박",
  business:      "회의 · 발표 · 협상",
  food:          "맛집 · 요리 · 음식 문화",
  entertainment: "영화 · TV · 음악 · 연예",
  tech:          "IT · AI · 게임 · 트렌드",
  sports:        "스포츠 · 운동 · 건강",
  relationships: "친구 · 가족 · 연애",
};

interface Props {
  personaId: PersonaId;
  topicId: string | null;
  onSelectTopic: (id: string | null) => void;
  onBack: () => void;
  onStart: () => void;
}

export default function TopicStep({ personaId, topicId, onSelectTopic, onBack, onStart }: Props) {
  const persona = PERSONAS[personaId];
  const btn     = PERSONA_BTN[personaId];

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] fade-up">

      {/* ── Top bar ── */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            {/* Selected tutor pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60">
              <span className="text-base">{persona.emoji}</span>
              <span className="text-xs font-bold text-white">{persona.name}</span>
              <span className="text-[10px] text-slate-500">{persona.roleKo}</span>
            </div>
          </div>
          {/* Step progress dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-1.5 rounded-full bg-slate-700" />
            <span className="w-6 h-1.5 rounded-full bg-indigo-500" />
          </div>
        </div>

        <h1 className="text-lg font-bold text-white">주제를 선택하세요</h1>
        <p className="text-sm text-slate-500 mt-0.5">선택 안 해도 자유롭게 대화할 수 있어요</p>
      </div>

      {/* ── Topic list ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">

        {/* Free talk — highlighted card */}
        <button
          onClick={() => onSelectTopic(null)}
          className={[
            "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all duration-200",
            topicId === null
              ? "bg-indigo-600 shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/70 hover:bg-slate-800",
          ].join(" ")}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${topicId === null ? "bg-white/20" : "bg-slate-700/60"}`}>
            💬
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${topicId === null ? "text-white" : "text-slate-100"}`}>
              자유 대화
            </p>
            <p className={`text-xs mt-0.5 ${topicId === null ? "text-indigo-200" : "text-slate-500"}`}>
              어떤 주제든 제한 없이
            </p>
          </div>
          {topicId === null && (
            <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-0.5">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-[10px] text-slate-600 font-medium tracking-wide">주제 선택</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* Topic grid — 2 columns */}
        <div className="grid grid-cols-2 gap-2">
          {TOPICS.map((t) => {
            const active = t.id === topicId;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTopic(active ? null : t.id)}
                className={[
                  "flex flex-col gap-2 p-3.5 rounded-2xl text-left transition-all duration-200",
                  active
                    ? "bg-indigo-600 shadow-lg shadow-indigo-950/50 scale-[1.02]"
                    : "bg-slate-800/70 hover:bg-slate-800 hover:scale-[1.01]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between w-full">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${active ? "bg-white/20" : "bg-slate-700/50"}`}>
                    {t.emoji}
                  </span>
                  {active && (
                    <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-white" />
                    </span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-bold leading-tight ${active ? "text-white" : "text-slate-100"}`}>
                    {t.nameKo}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-snug ${active ? "text-indigo-200" : "text-slate-500"}`}>
                    {TOPIC_DESC[t.id] ?? ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Start Button ── */}
      <div className="px-4 pt-2 pb-8 shrink-0">
        <button
          onClick={onStart}
          className={[
            "w-full flex items-center justify-center gap-2 py-4 rounded-2xl",
            "font-semibold text-base text-white shadow-lg transition-all duration-150 active:scale-[0.98] hover:brightness-110",
            btn.bg, btn.shadow,
          ].join(" ")}
        >
          <Sparkles size={17} />
          대화 시작하기
        </button>
      </div>

    </div>
  );
}
