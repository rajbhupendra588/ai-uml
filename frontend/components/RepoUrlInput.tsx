"use client";

import React, { useState } from "react";
import { Github, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RepoUrlInputProps {
  onSelectRepo: (repoUrl: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
  className?: string;
}

function isValidRepoUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+/.test(trimmed) || /^github\.com\/[^/]+\/[^/]+/.test(trimmed);
}

function normalizeRepoUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http")) {
    url = "https://" + url.replace(/^github\.com/, "github.com");
  }
  if (!url.includes("github.com")) {
    url = "https://github.com/" + url;
  }
  // Remove trailing slash and extra path segments
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://github.com/${parts[0]}/${parts[1]}`;
      }
    }
  } catch {
    /* ignore */
  }
  return url;
}

export function RepoUrlInput({
  onSelectRepo,
  isLoading = false,
  onClose,
  className,
}: RepoUrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Please enter a GitHub repository URL");
      return;
    }
    if (!isValidRepoUrl(trimmed)) {
      toast.error("Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)");
      return;
    }
    const normalized = normalizeRepoUrl(trimmed);
    onSelectRepo(normalized);
    setUrl("");
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">GitHub Repo</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-b border-[var(--border)] p-3">
        <label className="mb-2 block text-xs font-medium text-[var(--muted)]">
          Paste GitHub repository URL
        </label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2">
            <Github className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--muted)]">
          Example: https://github.com/vercel/next.js
        </p>
      </form>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary)]">
          <Github className="h-7 w-7 text-[var(--muted)]" />
        </div>
        <p className="text-sm text-[var(--muted)]">
          Enter a repo URL to analyze and generate a diagram
        </p>
      </div>
    </div>
  );
}
