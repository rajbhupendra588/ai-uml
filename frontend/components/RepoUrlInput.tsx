"use client";

import React, { useState, useCallback } from "react";
import { Github, ArrowRight, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getGithubUserReposUrl, type GithubRepo } from "@/lib/api";

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
  const [mode, setMode] = useState<"url" | "username">("url");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
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

  const handleUsernameSubmit = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error("Please enter a GitHub username");
      return;
    }
    setLoadingRepos(true);
    setUsernameError(null);
    try {
      const res = await fetch(getGithubUserReposUrl(trimmed));
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail ?? "Failed to fetch repos";
        setUsernameError(typeof msg === "string" ? msg : "Failed to fetch repos");
        setRepos([]);
        return;
      }
      setRepos(data.repos ?? []);
    } catch {
      setUsernameError("Network error");
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }, [username]);

  const handleSelectRepo = (repo: GithubRepo) => {
    const repoUrl = repo.html_url ?? `https://github.com/${repo.full_name ?? ""}`;
    onSelectRepo(repoUrl);
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

      {/* Mode tabs */}
      <div className="flex shrink-0 gap-1 border-b border-[var(--border)] px-3 pt-2">
        <button
          type="button"
          onClick={() => { setMode("url"); setUsernameError(null); setRepos([]); }}
          className={cn(
            "px-3 py-2 text-xs font-medium rounded-t-md transition",
            mode === "url"
              ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] border-b-transparent -mb-px"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          Paste URL
        </button>
        <button
          type="button"
          onClick={() => { setMode("username"); setUsernameError(null); }}
          className={cn(
            "px-3 py-2 text-xs font-medium rounded-t-md transition flex items-center gap-1",
            mode === "username"
              ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] border-b-transparent -mb-px"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          <Search className="h-3 w-3" />
          Username
        </button>
      </div>

      {mode === "url" && (
        <form onSubmit={handleUrlSubmit} className="shrink-0 border-b border-[var(--border)] p-3">
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
      )}

      {mode === "username" && (
        <div className="shrink-0 border-b border-[var(--border)] p-3">
          <label className="mb-2 block text-xs font-medium text-[var(--muted)]">
            Enter GitHub username to browse repos
          </label>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2">
              <Github className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameError(null); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUsernameSubmit())}
                placeholder="vercel"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleUsernameSubmit}
              disabled={loadingRepos || !username.trim()}
              className="flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition min-w-[80px]"
            >
              {loadingRepos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </>
              )}
            </button>
          </div>
          {usernameError && (
            <p className="mt-1.5 text-[10px] text-amber-500">{usernameError}</p>
          )}
        </div>
      )}

      {/* Repo list (username mode) or empty state (url mode) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {mode === "username" && (repos.length > 0 || loadingRepos) ? (
          <div className="p-3 space-y-1">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[var(--muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading repos...</span>
              </div>
            ) : (
              repos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelectRepo(repo)}
                  disabled={isLoading}
                  className="w-full flex flex-col items-start gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:bg-[var(--secondary)] hover:border-[var(--primary)]/50 transition disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-[var(--foreground)] truncate w-full">
                    {repo.full_name ?? repo.name}
                  </span>
                  {repo.description && (
                    <span className="text-xs text-[var(--muted)] line-clamp-2">{repo.description}</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {repo.language && (
                      <span className="text-[10px] text-[var(--muted)]">{repo.language}</span>
                    )}
                    {typeof repo.stargazers_count === "number" && repo.stargazers_count > 0 && (
                      <span className="text-[10px] text-[var(--muted)]">⭐ {repo.stargazers_count}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : mode === "username" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary)]">
              <Search className="h-7 w-7 text-[var(--muted)]" />
            </div>
            <p className="text-sm text-[var(--muted)]">
              Enter a GitHub username to browse their public repos
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary)]">
              <Github className="h-7 w-7 text-[var(--muted)]" />
            </div>
            <p className="text-sm text-[var(--muted)]">
              Enter a repo URL to analyze and generate a diagram
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
