"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Github as GithubIcon,
  Mic,
  MicOff,
  Trash2,
  PanelRightClose,
  Pencil,
  Bot,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ContextMessage } from "./ContextPanel";
import { GitHubReposPanel } from "./GitHubReposPanel";
import { HldComponentsPanel } from "./HldComponentsPanel";

// Re-export ContextMessage so Canvas can import from here
export type { ContextMessage };

/* ---------- Voice helpers ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => unknown;
    webkitSpeechRecognition?: new () => unknown;
  };
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => any) // eslint-disable-line @typescript-eslint/no-explicit-any
    | null;
}

/* ---------- Example prompts ---------- */
const EXAMPLES = [
  "Login flow with Auth0",
  "AWS serverless API",
  "How Argo CD deployment works",
  "Microservices e-commerce system",
];

/* ---------- Props ---------- */
export interface SideKickProps {
  /* Chat messages */
  messages: ContextMessage[];
  onSendMessage: (message: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onClearHistory: () => void;
  /* Prompt submit */
  onSubmit: (prompt: string) => void;
  /* State */
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  /* Plan review (inline) */
  pendingPlan: {
    diagram_plan: Record<string, unknown>;
    diagram_type: string;
    prompt: string;
  } | null;
  onConfirmPlan?: () => void;
  onCancelPlan?: () => void;
  planSummary?: string;
  /* GitHub repos */
  onSelectRepo?: (repoUrl: string) => void;
  /** When this increments (e.g. on New diagram), GitHub panel clears its cached repos. */
  newDiagramCount?: number;
  /* HLD drill-down to LLD */
  diagramPlan?: Record<string, unknown> | null;
  diagramType?: string;
  onGenerateLld?: (componentName: string) => void;
}

type SideKickTab = "chat" | "github";

/* ================================================================== */
export function SideKick({
  messages,
  onSendMessage,
  onEditMessage,
  onClearHistory,
  onSubmit,
  isLoading,
  isOpen,
  onClose,
  pendingPlan,
  onConfirmPlan,
  onCancelPlan,
  planSummary,
  onSelectRepo,
  newDiagramCount = 0,
  diagramPlan = null,
  diagramType = "architecture",
  onGenerateLld,
}: SideKickProps) {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<SideKickTab>("chat");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    abort: () => void;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  /* --- Voice --- */
  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startVoiceInput = useCallback(() => {
    if (isLoading) return;
    const SR = getSpeechRecognition();
    if (!SR) return;
    stopListening();
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: {
      resultIndex: number;
      results: Array<{
        isFinal: boolean;
        [i: number]: { transcript: string };
      }>;
    }) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal && r[0]) transcript += r[0].transcript;
      }
      if (transcript) setInput((p) => (p ? p + " " + transcript : transcript));
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
  }, [isLoading, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  /* --- Edit --- */
  const handleStartEdit = (msg: ContextMessage) => {
    if (msg.role !== "user") return;
    setEditingMessageId(msg.id);
    setInput(msg.content);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInput("");
  };

  /* --- Submit --- */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (editingMessageId && onEditMessage) {
      onEditMessage(editingMessageId, trimmed);
      setEditingMessageId(null);
    } else {
      onSubmit(trimmed);
    }
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExampleClick = (example: string) => {
    onSubmit(example);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const hasMessages = messages.length > 0;

  return (
    <div
      className={cn(
        "shrink-0 border-l border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out flex flex-col",
        isOpen ? "w-96 max-w-[min(24rem,100vw)]" : "w-0"
      )}
      style={{ overflow: "hidden" }}
    >
      {/* ---- Header ---- */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--secondary)]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--primary)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Architect
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasMessages && activeTab === "chat" && (
              <button
                type="button"
                onClick={onClearHistory}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-red-500"
                title="Clear history"
                aria-label="Clear conversation history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              title="Close"
              aria-label="Close Architect"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex px-3 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition border-b-2",
              activeTab === "chat"
                ? "border-[var(--primary)] text-[var(--foreground)] bg-[var(--card)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Chat
            {hasMessages && (
              <span className="rounded-full bg-[var(--primary)]/20 px-1.5 py-0.5 text-[10px] text-[var(--primary)]">
                {messages.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("github")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition border-b-2",
              activeTab === "github"
                ? "border-[var(--primary)] text-[var(--foreground)] bg-[var(--card)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <GithubIcon className="h-3 w-3" />
            GitHub
          </button>
        </div>
      </div>

      {/* ---- GitHub tab (always mounted to preserve repos until New diagram) ---- */}
      {onSelectRepo && (
        <div className={cn("flex-1 overflow-hidden flex flex-col", activeTab !== "github" && "hidden")}>
          <GitHubReposPanel
            onSelectRepo={(url) => {
              onSelectRepo(url);
              setActiveTab("chat"); // Switch back to chat after selecting
            }}
            isLoading={isLoading}
            newDiagramCount={newDiagramCount}
          />
        </div>
      )}

      {/* ---- Chat tab: Messages / Welcome ---- */}
      <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", activeTab !== "chat" && "hidden")}>
        {diagramType === "hld" && diagramPlan?.layers && onGenerateLld && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <HldComponentsPanel
              diagramPlan={diagramPlan}
              diagramType={diagramType}
              onGenerateLld={onGenerateLld}
              isLoading={isLoading}
            />
          </div>
        )}
        {!hasMessages && !pendingPlan ? (
          /* ---- Welcome empty state ---- */
          <div className="flex h-full flex-col items-center justify-center text-center px-2">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/15">
              <Sparkles className="h-7 w-7 text-[var(--primary)]" />
            </div>
            <p className="text-base font-medium text-[var(--foreground)]">
              What are you working on?
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Describe your system and I&apos;ll generate a diagram
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => handleExampleClick(ex)}
                  disabled={isLoading}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ---- Chat bubbles ---- */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1 group",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3.5 py-2.5 relative",
                    msg.role === "user"
                      ? "bg-[var(--primary)] text-white rounded-br-md"
                      : "bg-[var(--secondary)] text-[var(--foreground)] rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap pr-5 leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.role === "user" && onEditMessage && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      disabled={isLoading}
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-white/20 transition-opacity disabled:opacity-50"
                      title="Edit and regenerate"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {msg.diagramType && msg.role === "assistant" && (
                    <span className="mt-1.5 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                      {msg.diagramType}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatTime(msg.timestamp)}
                  </span>
                  {editingMessageId === msg.id && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] underline"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* ---- Pending plan inline card ---- */}
            {pendingPlan && !isLoading && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
                <p className="text-xs font-medium text-[var(--primary)] mb-1">
                  Plan preview
                </p>
                <p className="text-sm text-[var(--foreground)] line-clamp-3">
                  {planSummary || "Plan ready"}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-[var(--primary)] text-white hover:opacity-90 text-xs h-7"
                    onClick={onConfirmPlan}
                  >
                    Generate diagram
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[var(--border)] text-xs h-7"
                    onClick={onCancelPlan}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="rounded-2xl rounded-bl-md bg-[var(--secondary)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 animate-pulse text-[var(--primary)]" />
                    <span className="text-sm text-[var(--muted)] animate-pulse">
                      Generating...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ---- Input area (chat tab only) ---- */}
      <div className={cn("shrink-0 border-t border-[var(--border)] bg-[var(--card)] p-3", activeTab !== "chat" && "hidden")}>
        {/* Text input + actions */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessageId
                  ? "Edit your message..."
                  : "Describe your system..."
              }
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 pr-20 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition"
              disabled={isLoading}
            />
            {/* Action buttons inside input */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {voiceSupported && (
                <button
                  type="button"
                  onClick={() =>
                    isListening ? stopListening() : startVoiceInput()
                  }
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition",
                    isListening
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                  )}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5 animate-pulse" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition",
                  input.trim()
                    ? "bg-[var(--primary)] text-white hover:opacity-90"
                    : "bg-[var(--secondary)] text-[var(--muted)]"
                )}
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[var(--muted)]">
            Enter to send · Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------- Toggle button for toolbar ---------- */
export interface SideKickToggleProps {
  onClick: () => void;
  isOpen: boolean;
}

export function SideKickToggle({ onClick, isOpen }: SideKickToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition",
        isOpen
          ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
      )}
      title={isOpen ? "Hide Architect" : "Show Architect"}
      aria-label={isOpen ? "Hide Architect" : "Show Architect"}
      aria-expanded={isOpen}
    >
      <Bot className="h-4 w-4" />
      <span className="hidden sm:inline">Architect</span>
    </button>
  );
}
