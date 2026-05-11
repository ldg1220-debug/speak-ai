"use client";

import { useState } from "react";
import { useCharacterStore } from "@/store/useCharacterStore";
import { PERSONAS, PersonaId } from "@/lib/personas";

const storageKey = (id: PersonaId) => `avaturn_url_${id}`;

export function loadSavedAvatarUrl(id: PersonaId): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(storageKey(id));
}

function removeSavedAvatarUrl(id: PersonaId) {
  localStorage.removeItem(storageKey(id));
}

interface Props {
  onClose: () => void;
}

const AVATAR_SOURCES = [
  {
    name: "Avaturn",
    desc: "무료 고품질 사실적 아바타",
    url: "https://avaturn.me",
    hint: "Sign up → Create Avatar → Export → .glb 링크 복사",
  },
  {
    name: "Sketchfab",
    desc: "무료 3D 캐릭터 모델 검색",
    url: "https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount&q=character",
    hint: "Download → GLB 형식 선택 → 직접 업로드 필요",
  },
];

export default function AvaturnCreator({ onClose }: Props) {
  const personaId = useCharacterStore((s) => s.personaId);
  const [target, setTarget] = useState<PersonaId>(
    personaId === "sunny" ? "aria" : personaId
  );
  const [inputUrl, setInputUrl]   = useState("");
  const [status, setStatus]       = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  const humanPersonas: PersonaId[] = ["aria", "kai", "sterling"];

  function handleSave() {
    const url = inputUrl.trim();
    if (!url) { setStatus("error"); setErrorMsg("URL을 입력하세요"); return; }
    if (!url.includes(".glb")) { setStatus("error"); setErrorMsg(".glb 파일 URL이어야 합니다"); return; }

    const finalUrl = url.includes("morphTargets")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}morphTargets=ARKit,Oculus+Visemes&textureAtlas=1024`;

    localStorage.setItem(storageKey(target), finalUrl);
    setStatus("saved");
    setTimeout(() => window.location.reload(), 900);
  }

  function handleRemove() {
    removeSavedAvatarUrl(target);
    setStatus("idle");
    setInputUrl("");
    window.location.reload();
  }

  const savedUrl = loadSavedAvatarUrl(target);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-lg rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-white font-semibold text-sm">아바타 설정</span>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Persona tabs */}
          <div className="flex gap-2">
            {humanPersonas.map((id) => {
              const p = PERSONAS[id];
              const hasSaved = !!loadSavedAvatarUrl(id);
              return (
                <button
                  key={id}
                  onClick={() => { setTarget(id); setInputUrl(""); setStatus("idle"); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${target === id ? "bg-indigo-600 text-white" : "bg-white/8 text-white/50 hover:text-white"}`}
                >
                  {p.emoji} {p.name}
                  {hasSaved && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                </button>
              );
            })}
          </div>

          {/* Current status */}
          {savedUrl ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-green-300 text-xs truncate">{savedUrl.split("?")[0].split("/").pop()}</span>
              </div>
              <button onClick={handleRemove} className="text-[10px] text-red-400 hover:text-red-300 shrink-0 ml-2">삭제</button>
            </div>
          ) : (
            <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs">
              {PERSONAS[target].name} 아바타 없음 — 아래에서 설정하세요
            </div>
          )}

          {/* Where to get GLB */}
          <div>
            <p className="text-[11px] text-white/40 mb-2 uppercase tracking-widest">무료 아바타 만들기</p>
            <div className="flex flex-col gap-2">
              {AVATAR_SOURCES.map((src) => (
                <a
                  key={src.name}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 transition-colors group"
                >
                  <div>
                    <p className="text-white text-xs font-medium group-hover:text-indigo-300 transition-colors">
                      {src.name} <span className="text-white/30 font-normal">— {src.desc}</span>
                    </p>
                    <p className="text-white/30 text-[10px] mt-0.5">{src.hint}</p>
                  </div>
                  <svg className="shrink-0 mt-0.5 ml-2 text-white/30" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* URL input */}
          <div>
            <p className="text-[11px] text-white/40 mb-2 uppercase tracking-widest">GLB URL 붙여넣기</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setStatus("idle"); }}
                placeholder="https://... .glb"
                className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/10 text-white text-xs placeholder-white/25 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={status === "saved"}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
              >
                {status === "saved" ? "저장됨 ✓" : "저장"}
              </button>
            </div>
            {status === "error" && (
              <p className="text-red-400 text-[10px] mt-1.5">{errorMsg}</p>
            )}
            {status === "saved" && (
              <p className="text-green-400 text-[10px] mt-1.5">저장됨 — 페이지를 새로고침합니다…</p>
            )}
            <p className="text-white/25 text-[10px] mt-2">
              아바타 사이트에서 Export 후 .glb 파일 링크를 복사해 붙여넣으세요
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
