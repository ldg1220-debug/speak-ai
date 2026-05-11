"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-4 h-11 border-b border-slate-800/80 bg-[#0a0f1e] shrink-0">
      <div className="flex items-center gap-1.5 select-none">
        <span className="text-sm font-bold text-white tracking-tight">NewsTalk</span>
        <span className="text-[9px] font-bold px-1 py-0.5 bg-indigo-600/30 text-indigo-400 rounded border border-indigo-500/30">EN</span>
      </div>
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-0.5">
        <Link
          href="/news"
          className={[
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            pathname === "/news"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          📰 뉴스
        </Link>
        <Link
          href="/"
          className={[
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            pathname === "/"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          🎤 튜터
        </Link>
      </div>
    </nav>
  );
}
