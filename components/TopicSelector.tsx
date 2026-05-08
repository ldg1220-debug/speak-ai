"use client";

import { TOPICS } from "@/lib/topics";

interface Props {
  current: string | null;
  onSelect: (id: string | null) => void;
}

export default function TopicSelector({ current, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-700/50 bg-slate-900/40 shrink-0"
         style={{ scrollbarWidth: "none" }}>
      {/* "Free talk" chip — deselects topic */}
      <button
        onClick={() => onSelect(null)}
        className={[
          "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
          current === null
            ? "bg-slate-600 text-white"
            : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300",
        ].join(" ")}
      >
        💬 <span>자유 대화</span>
      </button>

      {TOPICS.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(active ? null : t.id)}
            className={[
              "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
              active
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300",
            ].join(" ")}
          >
            {t.emoji} <span>{t.nameKo}</span>
          </button>
        );
      })}
    </div>
  );
}
