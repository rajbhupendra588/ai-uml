"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Trash2, PanelLeftClose, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  diagramType?: string;
}

interface ContextPanelProps {
  messages: ContextMessage[];
  onSendMessage: (message: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onClearHistory: () => void;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ContextPanel({
  messages,
  onSendMessage,
  onEditMessage,
  onClearHistory,
  isLoading = false,
  isOpen,
  onClose,
}: ContextPanelProps) {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load message content when editing
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const trimmed = input.trim();
    if (editingMessageId && onEditMessage) {
      onEditMessage(editingMessageId, trimmed);
      setEditingMessageId(null);
    } else {
      onSendMessage(trimmed);
    }
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "shrink-0 border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out flex flex-col",
        isOpen ? "w-80" : "w-0"
      )}
      style={{ overflow: "hidden" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--primary)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">Context Window</span>
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--muted)]">
            {messages.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-red-500"
              title="Clear history"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Close"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="h-10 w-10 text-[var(--muted)] mb-3" />
            <p className="text-sm text-[var(--muted)]">No conversation yet</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Your prompts and diagrams will appear here
            </p>
          </div>
        ) : (
          <>
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
                    "max-w-[85%] rounded-lg px-3 py-2 relative",
                    msg.role === "user"
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--secondary)] text-[var(--foreground)]"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap pr-6">{msg.content}</p>
                  {msg.role === "user" && onEditMessage && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      disabled={isLoading}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-white/20 transition-opacity disabled:opacity-50"
                      title="Edit and regenerate"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {msg.diagramType && msg.role === "assistant" && (
                    <span className="mt-1 inline-block rounded bg-[var(--accent)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
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
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-[var(--border)] bg-[var(--secondary)]/30 p-3"
      >
        <div className="flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={editingMessageId ? "Edit your message and press Enter to regenerate..." : "Add context or refine diagram..."}
            rows={3}
            className="min-w-0 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--muted)]">
              Press Enter to send, Shift+Enter for new line
            </p>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
            >
              <Send className="h-3 w-3" />
              {editingMessageId ? "Save & Regenerate" : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Toggle button for left sidebar
interface ContextToggleProps {
  onClick: () => void;
  isOpen: boolean;
  messageCount: number;
}

export function ContextToggle({ onClick, isOpen, messageCount }: ContextToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition",
        isOpen
          ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
      )}
      title={isOpen ? "Hide context" : "Show context"}
    >
      <MessageSquare className="h-4 w-4" />
      <span className="hidden sm:inline">Context</span>
      {messageCount > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs text-white">
          {messageCount}
        </span>
      )}
    </button>
  );
}
