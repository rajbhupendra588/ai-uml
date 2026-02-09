"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Cpu, Github, Plus, Mic, MicOff, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
// Web Speech API for voice input (Chrome, Edge, Safari)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => any) | null;
}

export type InputMode = "describe" | "github";

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  onGenerateFromRepo?: (repoUrl: string) => void;
  isLoading?: boolean;
  /** When true, show ChatGPT-style centered panel: "What are you working on?" + big input */
  centered?: boolean;
  /** If set, user is signed in with GitHub; show repo list in From repo mode */
  user?: { login: string } | null;
  /** If true, show Sign in with GitHub and repo list when signed in */
  githubOAuthEnabled?: boolean;
  /** Session token for API calls (X-Session-Token) when cross-origin */
  sessionToken?: string | null;
}

export function PromptBar({
  onSubmit,
  onGenerateFromRepo,
  isLoading,
  centered = false,
  user = null,
  githubOAuthEnabled = false,
  sessionToken = null,
}: PromptBarProps) {
  const [mode, setMode] = useState<InputMode>("describe");
  const [prompt, setPrompt] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
        rec.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startVoiceInput = useCallback(() => {
    if (mode !== "describe" || isLoading) return;
    const SR = getSpeechRecognition();
    if (!SR) return;
    stopListening();
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean;[i: number]: { transcript: string } }> }) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal && r[0]) transcript += r[0].transcript;
      }
      if (transcript) setPrompt((p) => (p ? p + " " + transcript : transcript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [mode, isLoading, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "describe" && prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt("");
    } else if (mode === "github" && repoUrl.trim() && onGenerateFromRepo) {
      onGenerateFromRepo(repoUrl.trim());
      setRepoUrl("");
    }
  };

  const isDescribe = mode === "describe";
  const canSubmit =
    isDescribe ? !!prompt.trim() : !!repoUrl.trim() && !!onGenerateFromRepo;

  const inputPlaceholder = isDescribe ? "Ask anything" : "https://github.com/owner/repo";

  if (centered) {
    return (
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
        <h2 className="mb-3 sm:mb-4 text-center text-lg sm:text-xl font-medium text-[var(--foreground)]">
          What are you working on?
        </h2>
        <form onSubmit={handleSubmit} className="relative">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border bg-[var(--card)] px-3 sm:px-4 py-2.5 sm:py-3 transition",
              isFocused ? "border-[var(--primary)]" : "border-[var(--border)]"
            )}
          >
            <button
              type="button"
              className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              aria-label="Attach"
            >
              <Plus className="h-5 w-5" />
            </button>
            {isDescribe ? (
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={inputPlaceholder}
                className="min-h-10 min-w-0 flex-1 border-0 bg-transparent text-sm sm:text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
                aria-label="Ask anything"
              />
            ) : (
              <Input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={inputPlaceholder}
                className="min-h-10 min-w-0 flex-1 border-0 bg-transparent text-sm sm:text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
                type="url"
                aria-label="GitHub repository URL"
              />
            )}
            {voiceSupported && isDescribe && (
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startVoiceInput())}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                  isListening
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                )}
                aria-label={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5 animate-pulse" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              type="button"
              className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              aria-label="Audio"
            >
              <BarChart2 className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setMode("describe")}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-medium transition",
                isDescribe ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              Describe
            </button>
            <span className="text-[var(--muted)]">·</span>
            <button
              type="button"
              onClick={() => setMode("github")}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-medium transition",
                !isDescribe ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              From repo
            </button>
          </div>
          <div className="mt-3 sm:mt-4 flex justify-center">
            <Button
              type="submit"
              disabled={isLoading || !canSubmit}
              className={cn(
                "h-10 sm:h-9 rounded-full px-6 sm:px-5",
                canSubmit ? "bg-[var(--primary)] text-white hover:opacity-90" : "bg-[var(--secondary)] text-[var(--muted)]"
              )}
              aria-label={isDescribe ? "Generate" : "Analyze repo"}
            >
              {isLoading ? (
                <Cpu className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
        <button
          type="button"
          onClick={() => setMode("describe")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
            isDescribe
              ? "bg-[var(--card)] text-[var(--foreground)] shadow"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
          aria-pressed={isDescribe}
          aria-label="Describe your system"
        >
          <Sparkles className="size-3.5 shrink-0" />
          Describe
        </button>
        <button
          type="button"
          onClick={() => setMode("github")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
            !isDescribe
              ? "bg-[var(--card)] text-[var(--foreground)] shadow"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
          aria-pressed={!isDescribe}
          aria-label="From GitHub repo"
        >
          <Github className="size-3.5 shrink-0" />
          From repo
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className={cn(
          "group flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 pl-3 sm:pl-4",
          isFocused && "border-[var(--primary)]"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] sm:h-9 sm:w-9",
            isLoading ? "animate-pulse text-[var(--primary)]" : "text-[var(--muted)]"
          )}
        >
          {isLoading ? (
            <Cpu className="h-4 w-4" aria-hidden />
          ) : isDescribe ? (
            <Sparkles className="h-4 w-4" aria-hidden />
          ) : (
            <Github className="h-4 w-4" aria-hidden />
          )}
        </div>
        {isDescribe ? (
          <>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask anything"
              className="min-w-0 flex-1 border-0 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              disabled={isLoading}
              aria-label="Description"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startVoiceInput())}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition sm:h-9 sm:w-9",
                  isListening
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                )}
                aria-label={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 animate-pulse sm:h-5 sm:w-5" />
                ) : (
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            )}
          </>
        ) : (
          <>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                user
                  ? "Or paste repo or sub-project URL (e.g. .../tree/main/apps/web)"
                  : "Paste repo or sub-project URL — sign in to list repos"
              }
              className="min-w-0 flex-1 border-0 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              disabled={isLoading}
              type="url"
              aria-label="GitHub repository URL"
            />
          </>
        )}
        <Button
          type="submit"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9",
            canSubmit ? "bg-[var(--primary)] text-white hover:opacity-90" : "bg-[var(--secondary)] text-[var(--muted)]"
          )}
          disabled={isLoading || !canSubmit}
          aria-label={isDescribe ? "Generate" : "Analyze repo and generate"}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
