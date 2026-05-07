"use client";

import { PERSONA_ORDER, PERSONAS, PersonaId } from "@/lib/personas";

interface Props {
  current: PersonaId;
  onSelect: (id: PersonaId) => void;
}

export default function PersonaSelector({ current, onSelect }: Props) {
  return (
    <div className="flex gap-2 px-3 py-2.5 overflow-x-auto border-b border-slate-700/50 bg-slate-900/60 shrink-0"
         style={{ scrollbarWidth: "none" }}>
      {PERSONA_ORDER.map((id) => {
        const p = PERSONAS[id];
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={[
              "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
              active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
            ].join(" ")}
          >
            <span className="text-lg leading-none">{p.emoji}</span>
            <div className="text-left leading-tight">
              <div className="font-semibold">{p.name}</div>
              <div className="text-[10px] opacity-60">{p.roleKo}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
