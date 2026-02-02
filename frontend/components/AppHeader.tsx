"use client";

import Link from "next/link";
import { LayoutGrid, Github } from "lucide-react";

export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-100 transition hover:text-white"
          aria-label="ArchitectAI Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ArchitectAI</span>
        </Link>
        <nav className="flex items-center gap-1">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
