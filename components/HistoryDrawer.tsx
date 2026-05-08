"use client";

import { X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { PERSONAS } from "@/lib/personas";
import { getTopicById } from "@/lib/topics";
import type { StoredSession } from "@/lib/storage";

interface Props {
  sessions: StoredSession[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500/20 text-green-400 border-green-500/30" :
    score >= 60 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                  "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${color}`}>
      {score}점
    </span>
  );
}

function SessionItem({ session, onDelete }: { session: StoredSession; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const persona = PERSONAS[session.personaId];
  const topic   = getTopicById(session.topicId);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
      >
        <span className="text-xl flex-shrink-0">{persona.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{persona.name}</span>
            {topic && (
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded">
                {topic.emoji} {topic.nameKo}
              </span>
            )}
            {session.report && <ScoreBadge score={session.report.overallScore} />}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {formatDate(session.startedAt)} · {session.messageCount}개 메시지
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />}
      </button>

      {/* Expanded: messages + report */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-3 space-y-3">

          {/* Quick message preview */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {session.messages.map((msg, i) => (
              <div key={i} className={`text-xs rounded-lg px-3 py-1.5 ${msg.role === "user" ? "bg-indigo-600/20 text-slate-300 text-right ml-6" : "bg-slate-700 text-slate-400 mr-6"}`}>
                {msg.text}
              </div>
            ))}
          </div>

          {/* Report summary if available */}
          {session.report && (
            <div className="bg-slate-700/40 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-xs text-slate-300 leading-relaxed">{session.report.overallFeedback}</p>
              {session.report.recommendations.slice(0, 2).map((r, i) => (
                <div key={i} className="text-[11px] text-sky-400">→ {r}</div>
              ))}
            </div>
          )}

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={11} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}

export default function HistoryDrawer({ sessions, onClose, onDelete }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">대화 기록</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center text-slate-600 text-sm mt-16">
              <div className="text-3xl mb-3">📭</div>
              저장된 대화가 없습니다.
            </div>
          ) : (
            sessions.map((s) => (
              <SessionItem key={s.id} session={s} onDelete={() => onDelete(s.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
