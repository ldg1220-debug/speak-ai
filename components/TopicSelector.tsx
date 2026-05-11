"use client";

import { TOPICS } from "@/lib/topics";

interface Props {
  current: string | null;
  onSelect: (id: string | null) => void;
}

export default function TopicSelector({ current, onSelect }: Props) {
  return (
    <div
      className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-800/60 bg-slate-950 shrink-0"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Free talk chip */}
      <button
        onClick={() => onSelect(null)}
        className={[
          "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150",
          current === null
            ? "bg-slate-600 text-white shadow-sm"
            : "bg-slate-800/80 text-slate-500 hover:bg-slate-700/80 hover:text-slate-300",
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
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150",
              active
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/30"
                : "bg-slate-800/80 text-slate-500 hover:bg-slate-700/80 hover:text-slate-300",
            ].join(" ")}
          >
            {t.emoji} <span>{t.nameKo}</span>
          </button>
        );
      })}
    </div>
  );
}
