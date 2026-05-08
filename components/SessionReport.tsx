"use client";

import { X, Star, TrendingUp, BookOpen, Target, MessageSquare } from "lucide-react";
import type { SessionReportData } from "@/lib/storage";

interface Props {
  report: SessionReportData;
  messageCount: number;
  avgPronunciation: number | null;
  onClose: () => void;
  onNewSession: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#f59e0b" :
    score >= 40 ? "#f97316" : "#ef4444";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} stroke="#1e293b" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={r}
          stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-2xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function PronScore({ score }: { score: number }) {
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs work";
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-amber-400" : score >= 40 ? "text-orange-400" : "text-red-400";
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{score}%</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function SessionReport({ report, messageCount, avgPronunciation, onClose, onNewSession }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-3 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <h2 className="text-base font-semibold text-slate-100">Session Report</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Score row */}
          <div className="flex items-center justify-around bg-slate-800/60 rounded-xl p-4">
            <div className="text-center">
              <ScoreRing score={report.overallScore} />
              <div className="text-[11px] text-slate-400 mt-1">Overall Score</div>
            </div>
            <div className="w-px h-14 bg-slate-700" />
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-400">{messageCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">Messages</div>
            </div>
            {avgPronunciation !== null && (
              <>
                <div className="w-px h-14 bg-slate-700" />
                <div className="text-center">
                  <PronScore score={avgPronunciation} />
                  <div className="text-[11px] text-slate-400 mt-0.5">발음</div>
                </div>
              </>
            )}
          </div>

          {/* Overall feedback */}
          <div className="bg-indigo-600/15 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed">
            {report.overallFeedback}
          </div>

          {/* Strengths */}
          {report.strengths?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-amber-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">잘한 점</h3>
              </div>
              <ul className="space-y-1.5">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-green-400 mt-0.5">✓</span> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Grammar corrections */}
          {report.corrections?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-indigo-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">문법 교정 ({report.corrections.length})</h3>
              </div>
              <div className="space-y-2">
                {report.corrections.map((c, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg px-3 py-2.5 text-sm">
                    <div className="text-red-400 line-through text-xs mb-0.5 opacity-70">{c.original}</div>
                    <div className="text-green-400 font-medium">{c.corrected}</div>
                    {c.explanation && (
                      <div className="text-slate-500 text-[11px] mt-1">{c.explanation}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Vocabulary */}
          {report.vocabularyHighlights?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-purple-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">어휘 하이라이트</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.vocabularyHighlights.map((v, i) => (
                  <span key={i} className="px-2.5 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-purple-300 text-xs">
                    {v}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {report.recommendations?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-sky-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">다음에 연습할 것</h3>
              </div>
              <ul className="space-y-1.5">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-sky-400 mt-0.5 flex-shrink-0">→</span> {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-700/60 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onNewSession}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
          >
            <TrendingUp size={14} />
            새 대화 시작
          </button>
        </div>
      </div>
    </div>
  );
}
