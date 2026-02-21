"use client";

import React, { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const isMac = typeof navigator !== "undefined" && navigator.platform?.toLowerCase().startsWith("mac");
const mod = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { keys: [mod, "Z"], label: "Undo" },
  { keys: [mod, "⇧", "Z"], label: "Redo" },
  { keys: [mod, "S"], label: "Save diagram" },
  { keys: [mod, "0"], label: "Zoom to fit" },
  { keys: [mod, "N"], label: "New diagram" },
  { keys: [mod, "E"], label: "Export menu" },
  { keys: [mod, "1"], label: "Toggle context panel" },
  { keys: [mod, "2"], label: "Toggle right panels" },
  { keys: ["?"], label: "Show this help" },
  { keys: ["Esc"], label: "Close overlay / cancel" },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function KeyboardShortcutsHelp({ isOpen, onClose, className }: KeyboardShortcutsHelpProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4",
        "bg-black/50 backdrop-blur-sm",
        className
      )}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <ul className="mt-3 space-y-2.5" role="list">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--foreground)]">{label}</span>
              <kbd className="flex gap-1 rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 font-mono text-xs text-[var(--muted-foreground)]">
                {keys.map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Shortcuts are disabled while typing in a text field.
        </p>
      </div>
    </div>
  );
}
