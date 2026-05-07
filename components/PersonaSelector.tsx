"use client";

import { PERSONA_ORDER, PERSONAS, PersonaId } from "@/lib/personas";

interface Props {
  current: PersonaId;
  onSelect: (id: PersonaId) => void;
}

export default function PersonaSelector({ current, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5 border-b border-slate-700/50 bg-slate-900/60 shrink-0">
      {PERSONA_ORDER.map((id) => {
        const p = PERSONAS[id];
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={[
              "flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-all duration-200",
              active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
            ].join(" ")}
          >
            <span className="text-2xl leading-none">{p.emoji}</span>
            <div className="text-[11px] font-semibold leading-tight">{p.name}</div>
            <div className="text-[9px] opacity-60 leading-tight">{p.roleKo}</div>
          </button>
        );
      })}
    </div>
  );
}
