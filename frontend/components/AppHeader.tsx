"use client";

import Link from "next/link";
import { LayoutGrid, HelpCircle } from "lucide-react";
import { useState } from "react";
import { UserMenu } from "./auth/UserMenu";
import { LoginModal } from "./auth/LoginModal";
import { SignupModal } from "./auth/SignupModal";
import { cn } from "@/lib/utils";

export type ViewMode = "generate" | "editor" | "codeToDiagram";

interface AppHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onStartTour?: () => void;
}

export function AppHeader({ viewMode, setViewMode, onStartTour }: AppHeaderProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <>
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

          <div className="flex items-center gap-1 rounded-lg bg-slate-900/50 p-1 ml-6 border border-white/5">
            <button
              id="nav-generate"
              onClick={() => setViewMode("generate")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "generate"
                  ? "bg-indigo-500/10 text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              Generate
            </button>
            <button
              id="nav-code-to-diagram"
              onClick={() => setViewMode("codeToDiagram")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "codeToDiagram"
                  ? "bg-indigo-500/10 text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              Code to Diagram
            </button>
            <button
              id="nav-editor"
              onClick={() => setViewMode("editor")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "editor"
                  ? "bg-indigo-500/10 text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              Editor
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-indigo-300 font-bold">New</span>
            </button>
          </div>

          <nav className="flex items-center gap-2 ml-auto">
            <button
              id="start-tour-btn"
              onClick={onStartTour}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
              title="Start Tour"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Tour</span>
            </button>
            <UserMenu
              onLoginClick={() => setLoginOpen(true)}
              onSignupClick={() => setSignupOpen(true)}
            />
          </nav>
        </div>
      </header>
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => window.dispatchEvent(new Event("auth-change"))}
        onSwitchToSignup={() => {
          setLoginOpen(false);
          setSignupOpen(true);
        }}
      />
      <SignupModal
        isOpen={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSuccess={() => window.dispatchEvent(new Event("auth-change"))}
        onSwitchToLogin={() => {
          setSignupOpen(false);
          setLoginOpen(true);
        }}
      />
    </>
  );
}
