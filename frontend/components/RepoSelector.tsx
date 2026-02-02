"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getGithubReposUrl, type GithubRepo } from "@/lib/api";

interface RepoSelectorProps {
  onSelect: (repoUrl: string) => void;
  disabled?: boolean;
  className?: string;
  sessionToken?: string | null;
}

export function RepoSelector({ onSelect, disabled, className, sessionToken }: RepoSelectorProps) {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  const fetchRepos = useCallback(() => {
    setLoading(true);
    setError(null);
    const headers: HeadersInit = {};
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
    fetch(getGithubReposUrl(), { credentials: "include", headers })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load repos");
        return r.json();
      })
      .then((d) => setRepos(d.repos ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load repos"))
      .finally(() => setLoading(false));
  }, [sessionToken]);

  useEffect(() => {
    if (open && repos.length === 0 && !loading) fetchRepos();
  }, [open, repos.length, loading, fetchRepos]);

  const filtered = filter.trim()
    ? repos.filter(
        (r) =>
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.full_name.toLowerCase().includes(filter.toLowerCase())
      )
    : repos;

  const handleSelect = (repo: GithubRepo) => {
    onSelect(repo.html_url);
    setOpen(false);
    setFilter("");
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="w-full justify-between gap-2 border-slate-600/80 bg-slate-800/90 text-slate-200 hover:bg-slate-700/90 sm:min-w-[220px]"
      >
        <span className="truncate">
          {loading ? "Loading repos…" : "Select a repo"}
        </span>
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : (
          <ChevronDown className="size-4 shrink-0" />
        )}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-800/95 shadow-xl">
            <div className="border-b border-slate-700/80 p-2">
              <Input
                placeholder="Filter repos…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 border-slate-600/80 bg-slate-900/80 text-sm text-slate-100 placeholder:text-slate-500"
                autoFocus
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto p-1">
              {error && (
                <p className="px-2 py-3 text-xs text-red-400">{error}</p>
              )}
              {!error && filtered.length === 0 && !loading && (
                <p className="px-2 py-3 text-xs text-slate-500">
                  {repos.length === 0 ? "No repos found." : "No repos match the filter."}
                </p>
              )}
              {!error &&
                filtered.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => handleSelect(repo)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80 hover:text-slate-100"
                  >
                    <Github className="size-4 shrink-0 text-slate-500" />
                    <span className="truncate">{repo.full_name}</span>
                    {repo.private && (
                      <span className="shrink-0 text-[10px] text-slate-500">private</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
