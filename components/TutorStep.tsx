"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import { PERSONAS, PERSONA_ORDER, PersonaId } from "@/lib/personas";

const CharacterScene = dynamic(() => import("@/components/CharacterScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-300 to-sky-100">
      <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    </div>
  ),
});

// Persona-specific static Tailwind class maps (must be literal strings for JIT)
const CARD_ACTIVE: Record<PersonaId, { bg: string; shadow: string; tagline: string; ring: string }> = {
  sunny:    { bg: "bg-amber-500",  shadow: "shadow-amber-950/50",  tagline: "text-amber-100",   ring: "ring-amber-400/60"  },
  aria:     { bg: "bg-violet-600", shadow: "shadow-violet-950/50", tagline: "text-violet-100",  ring: "ring-violet-400/60" },
  kai:      { bg: "bg-sky-600",    shadow: "shadow-sky-950/50",    tagline: "text-sky-100",     ring: "ring-sky-400/60"    },
  sterling: { bg: "bg-slate-500",  shadow: "shadow-slate-950/50",  tagline: "text-slate-200",   ring: "ring-slate-300/50"  },
};

const CARD_ICON_BG: Record<PersonaId, string> = {
  sunny:    "bg-amber-500/15",
  aria:     "bg-violet-500/15",
  kai:      "bg-sky-500/15",
  sterling: "bg-slate-500/15",
};

const TAGLINES: Record<PersonaId, string> = {
  sunny:    "아이들을 위한 친근한 영어",
  aria:     "따뜻하고 꼼꼼한 교정",
  kai:      "자연스러운 원어민 표현",
  sterling: "격식체 비즈니스 영어",
};

interface Props {
  selected: PersonaId;
  onSelect: (id: PersonaId) => void;
  onNext: () => void;
}

export default function TutorStep({ selected, onSelect, onNext }: Props) {
  const dummyRef = useRef<number>(0);
  const style    = CARD_ACTIVE[selected];

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] fade-up">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-1 shrink-0">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">AI English Tutor</p>
          <h1 className="text-lg font-bold text-white mt-0.5">튜터를 선택하세요</h1>
        </div>
        {/* Step progress dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-1.5 rounded-full bg-indigo-500" />
          <span className="w-2 h-1.5 rounded-full bg-slate-700" />
        </div>
      </div>

      {/* ── 3D Character Preview ── */}
      <div
        className={`relative mx-4 mt-3 rounded-3xl overflow-hidden shrink-0 ring-2 transition-all duration-300 ${style.ring}`}
        style={{ height: 220 }}
      >
        <CharacterScene
          personaId={selected}
          characterState="idle"
          amplitudeRef={dummyRef as React.MutableRefObject<number>}
        />
        {/* Gradient bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/60 to-transparent pointer-events-none" />
        {/* Name badge */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold border border-white/10">
            {PERSONAS[selected].emoji} {PERSONAS[selected].name}
            <span className="text-white/50">· {PERSONAS[selected].roleKo}</span>
          </span>
        </div>
      </div>

      {/* ── Persona Cards ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-2.5">
          {PERSONA_ORDER.map((id) => {
            const p      = PERSONAS[id];
            const active = id === selected;
            const s      = CARD_ACTIVE[id];
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={[
                  "relative flex flex-col gap-2.5 p-4 rounded-2xl text-left transition-all duration-200 overflow-hidden",
                  active
                    ? `${s.bg} ${s.shadow} shadow-lg scale-[1.02]`
                    : `bg-slate-800/70 hover:bg-slate-800 hover:scale-[1.01]`,
                ].join(" ")}
              >
                {/* Active indicator */}
                {active && (
                  <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                )}

                {/* Emoji with tinted bg */}
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                    active ? "bg-white/20" : CARD_ICON_BG[id]
                  }`}
                >
                  {p.emoji}
                </span>

                <div>
                  <p className={`text-sm font-bold leading-tight ${active ? "text-white" : "text-slate-100"}`}>
                    {p.name}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 leading-tight ${active ? "text-white/70" : "text-slate-500"}`}>
                    {p.roleKo}
                  </p>
                  <p className={`text-[10px] mt-1 leading-snug ${active ? s.tagline : "text-slate-600"}`}>
                    {TAGLINES[id]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Continue Button ── */}
      <div className="px-4 pt-2 pb-8 shrink-0">
        <button
          onClick={onNext}
          className={[
            "w-full flex items-center justify-center gap-2 py-4 rounded-2xl",
            "font-semibold text-base text-white shadow-lg transition-all duration-150 active:scale-[0.98]",
            style.bg, style.shadow,
            "hover:brightness-110",
          ].join(" ")}
        >
          다음 단계
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
}
