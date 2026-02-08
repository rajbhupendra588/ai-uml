"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Github, Globe, RefreshCw, ChevronRight, Search, FolderGit2, ArrowRight, X } from "lucide-react";
import { getGithubUserReposUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GITHUB_REPOS_STORAGE_KEY = "architect_github_repos";
const GITHUB_USERNAMES_STORAGE_KEY = "architect_github_usernames";
const MAX_RECENT_USERNAMES = 5;

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

interface GitHubReposPanelProps {
  onSelectRepo: (repoUrl: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
  /** When this increments (e.g. New diagram), clear cached repos. */
  newDiagramCount?: number;
}

function loadRecentUsernames(): string[] {
  try {
    const s = localStorage.getItem(GITHUB_USERNAMES_STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_USERNAMES) : [];
  } catch {
    return [];
  }
}

function saveRecentUsername(username: string): void {
  const recent = loadRecentUsernames();
  const filtered = recent.filter((u) => u.toLowerCase() !== username.toLowerCase());
  const updated = [username, ...filtered].slice(0, MAX_RECENT_USERNAMES);
  try {
    localStorage.setItem(GITHUB_USERNAMES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

export function GitHubReposPanel({
  onSelectRepo,
  isLoading = false,
  onClose,
  newDiagramCount = 0,
}: GitHubReposPanelProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [recentUsernames, setRecentUsernames] = useState<string[]>([]);
  const [pasteUrl, setPasteUrl] = useState("");

  // Extract username from GitHub URL or use as-is
  // Load persisted repos and recent usernames on mount
  useEffect(() => {
    setRecentUsernames(loadRecentUsernames());
    try {
      const s = localStorage.getItem(GITHUB_REPOS_STORAGE_KEY);
      if (!s) return;
      const data = JSON.parse(s) as { repos?: GitHubRepo[]; currentUser?: string };
      if (Array.isArray(data.repos) && data.repos.length > 0) {
        setRepos(data.repos);
        if (typeof data.currentUser === "string") setCurrentUser(data.currentUser);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Clear repos when New diagram is clicked
  useEffect(() => {
    if (newDiagramCount > 0) {
      setRepos([]);
      setCurrentUser(null);
      setError(null);
      setSearchQuery("");
      try {
        localStorage.removeItem(GITHUB_REPOS_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [newDiagramCount]);

  const extractUsername = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    // Handle full GitHub URLs
    const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
    if (urlMatch) return urlMatch[1];
    
    // Handle just username
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
    
    return null;
  };

  const fetchRepos = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getGithubUserReposUrl(username));
      const data = await res.json();

      if (!res.ok) {
        const message = data.detail || "Failed to fetch repositories";
        throw new Error(message);
      }

      const reposList = data.repos || [];
      const user = data.username || username;
      setRepos(reposList);
      setCurrentUser(user);
      saveRecentUsername(user);
      setRecentUsernames(loadRecentUsernames());
      try {
        localStorage.setItem(
          GITHUB_REPOS_STORAGE_KEY,
          JSON.stringify({ repos: reposList, currentUser: user })
        );
      } catch {
        /* ignore */
      }
      if (reposList.length === 0) {
        toast.info(`No public repos found for ${username}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repos";
      setError(message);
      toast.error(message);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const username = extractUsername(githubInput);
      if (!username) {
        toast.error("Please enter a valid GitHub username or profile URL");
        return;
      }
      fetchRepos(username);
    },
    [githubInput, fetchRepos]
  );

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">GitHub Repos</span>
          {repos.length > 0 && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--muted)]">
              {repos.length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* GitHub username input */}
      <form onSubmit={handleSubmit} className="shrink-0 border-b border-[var(--border)] p-3">
        <label className="mb-2 block text-xs font-medium text-[var(--muted)]">
          GitHub Username or Profile URL
        </label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2">
            <Github className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              type="text"
              value={githubInput}
              onChange={(e) => setGithubInput(e.target.value)}
              placeholder="username or github.com/username"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !githubInput.trim()}
            className="flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-2 flex gap-1.5 items-center">
          <input
            type="text"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pasteUrl.trim() && /github\.com/i.test(pasteUrl)) {
                e.preventDefault();
                onSelectRepo(pasteUrl.trim());
                setPasteUrl("");
              }
            }}
            placeholder="Or paste repo/sub-project URL"
            className="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={() => {
              const url = pasteUrl.trim();
              if (url && /github\.com/i.test(url)) {
                onSelectRepo(url);
                setPasteUrl("");
              }
            }}
            disabled={!pasteUrl.trim() || isLoading}
            className="shrink-0 rounded px-2 py-1 text-xs bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            Go
          </button>
        </div>
        {recentUsernames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-[var(--muted)] self-center">Recent:</span>
            {recentUsernames.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setGithubInput(u);
                  fetchRepos(u);
                }}
                disabled={loading}
                className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 transition"
              >
                {u}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Current user info & search */}
      {currentUser && repos.length > 0 && (
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-[var(--muted)]">
              Public repos for <span className="font-medium text-[var(--foreground)]">{currentUser}</span>
            </span>
            <button
              type="button"
              onClick={() => fetchRepos(currentUser)}
              disabled={loading}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter repos..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Repos list */}
      <div className="flex-1 overflow-y-auto">
        {!currentUser && !loading ? (
          <div className="flex flex-col items-center justify-center gap-4 p-6 text-center h-full">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary)]">
              <Github className="h-7 w-7 text-[var(--muted)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">
                Enter a GitHub username to list their public repositories
              </p>
            </div>
          </div>
        ) : loading && repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-[var(--muted)]" />
            <p className="text-xs text-[var(--muted)]">Loading repos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : filteredRepos.length === 0 && currentUser ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-[var(--muted)]">
              {searchQuery ? "No repos match your filter" : "No public repositories"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filteredRepos.map((repo) => (
              <li key={repo.id}>
                <button
                  type="button"
                  onClick={() => onSelectRepo(repo.html_url)}
                  disabled={isLoading}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--secondary)] disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]">
                    <Globe className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {repo.name}
                    </p>
                    {repo.description && (
                      <p className="truncate text-xs text-[var(--muted)]">
                        {repo.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                      {repo.language && <span>{repo.language}</span>}
                      {repo.stargazers_count > 0 && <span>★ {repo.stargazers_count}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
