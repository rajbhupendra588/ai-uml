"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FolderOpen,
  Trash2,
  RefreshCw,
  X,
  Search,
  Grid3X3,
  List,
  Clock,
  FileCode2,
  MoreVertical,
  Code2,
  ChevronDown,
} from "lucide-react";
import { getDiagramsUrl, getDiagramUrl, DIAGRAM_TYPE_LABELS } from "@/lib/api";
import type { DiagramType } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Node, Edge } from "@xyflow/react";

export interface DiagramSummary {
  id: number;
  title: string;
  diagram_type: string;
  created_at: string | null;
  updated_at: string | null;
}

interface DiagramsListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (data: {
    diagramCode: string | null;
    nodes: Node[];
    edges: Edge[];
    diagramType: string;
    diagramPlan?: Record<string, unknown> | null;
    diagramId?: number;
    title?: string;
  }) => void;
  className?: string;
}

const DIAGRAM_TYPE_COLORS: Record<string, string> = {
  architecture: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  hld: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  sequence: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  usecase: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  activity: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  state: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  component: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  deployment: "bg-red-500/15 text-red-400 border-red-500/20",
  flowchart: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  mindtree: "bg-lime-500/15 text-lime-400 border-lime-500/20",
  chat: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return date.toLocaleDateString();
}

type ViewMode = "list" | "grid";
type SortBy = "updated" | "created" | "title";

export function DiagramsListPanel({
  isOpen,
  onClose,
  onLoad,
  className,
}: DiagramsListPanelProps) {
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [filterType, setFilterType] = useState<string>("all");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getDiagramsUrl(), { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please log in to view your diagrams");
          return;
        }
        throw new Error("Failed to load diagrams");
      }
      const data = await res.json();
      setDiagrams(data.diagrams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDiagrams();
      setSearchQuery("");
      setFilterType("all");
    }
  }, [isOpen, fetchDiagrams]);

  // Get unique diagram types for filter
  const availableTypes = useMemo(() => {
    const types = new Set(diagrams.map((d) => d.diagram_type));
    return Array.from(types).sort();
  }, [diagrams]);

  // Filter and sort diagrams
  const filteredDiagrams = useMemo(() => {
    let result = [...diagrams];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.diagram_type.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (filterType !== "all") {
      result = result.filter((d) => d.diagram_type === filterType);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "created":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case "updated":
        default:
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
      }
    });

    return result;
  }, [diagrams, searchQuery, filterType, sortBy]);

  const handleLoad = async (id: number) => {
    setLoadingId(id);
    try {
      const res = await fetch(getDiagramUrl(id), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load diagram");
      const d = await res.json();
      const data = d.diagram_data || {};
      const code = d.mermaid_code || data.mermaid || data.code || null;
      const nodes = (data.nodes || []) as Node[];
      const edges = (data.edges || []) as Edge[];
      onLoad({
        diagramCode: code,
        nodes,
        edges,
        diagramType: d.diagram_type || "architecture",
        diagramPlan: data.diagram_plan || null,
        diagramId: id,
        title: d.title,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this diagram? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(getDiagramUrl(id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
        className
      )}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border)] px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  My Diagrams
                </h2>
                <p className="text-[11px] text-[var(--muted)]">
                  {diagrams.length} diagram{diagrams.length !== 1 ? "s" : ""} saved
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={fetchDiagrams}
                disabled={loading}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search + controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search diagrams..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Type filter dropdown */}
            {availableTypes.length > 1 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 px-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer min-w-[80px]"
              >
                <option value="all">All types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {DIAGRAM_TYPE_LABELS[t as DiagramType] || t}
                  </option>
                ))}
              </select>
            )}

            {/* View mode toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                title="Grid view"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Sort tabs */}
          <div className="flex items-center gap-1 mt-2.5">
            {(
              [
                { key: "updated", label: "Recent" },
                { key: "created", label: "Created" },
                { key: "title", label: "Name" },
              ] as { key: SortBy; label: string }[]
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortBy(s.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  sortBy === s.key
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]/50"
                )}
              >
                {s.label}
              </button>
            ))}
            {searchQuery && (
              <span className="ml-auto text-[11px] text-[var(--muted)]">
                {filteredDiagrams.length} result{filteredDiagrams.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-4 text-sm text-red-500 flex items-center gap-1.5 bg-red-500/10 rounded-lg px-3 py-2">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          )}
          {loading && diagrams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--muted)]" />
              <p className="text-xs text-[var(--muted)]">Loading diagrams...</p>
            </div>
          ) : diagrams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--secondary)] mb-2">
                <FileCode2 className="h-8 w-8 text-[var(--muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">No diagrams yet</p>
              <p className="text-xs text-[var(--muted)] text-center max-w-[200px]">
                Create a diagram and click Save to store it here for later access.
              </p>
            </div>
          ) : filteredDiagrams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Search className="h-8 w-8 text-[var(--muted)] mb-1" />
              <p className="text-sm font-medium text-[var(--foreground)]">No matches</p>
              <p className="text-xs text-[var(--muted)]">
                Try a different search term
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-2 gap-2.5">
              {filteredDiagrams.map((d) => (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleLoad(d.id)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoad(d.id)}
                  className={cn(
                    "group relative flex flex-col rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:border-blue-500/40 hover:bg-[var(--secondary)]/50 hover:shadow-lg transition-all duration-200",
                    loadingId === d.id && "opacity-60 pointer-events-none",
                    deletingId === d.id && "opacity-40 scale-95"
                  )}
                >
                  {/* Type badge */}
                  <div className="mb-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        DIAGRAM_TYPE_COLORS[d.diagram_type] ||
                        "bg-gray-500/15 text-gray-400 border-gray-500/20"
                      )}
                    >
                      {DIAGRAM_TYPE_LABELS[d.diagram_type as DiagramType] || d.diagram_type}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium text-[var(--foreground)] truncate mb-1">
                    {d.title}
                  </p>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                    <Clock className="h-3 w-3" />
                    {relativeTime(d.updated_at || d.created_at)}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, d.id)}
                    className="absolute top-2 right-2 rounded-md p-1 text-[var(--muted)] hover:bg-red-500/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Loading indicator */}
                  {loadingId === d.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--card)]/80">
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <ul className="space-y-1.5">
              {filteredDiagrams.map((d) => (
                <li key={d.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLoad(d.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoad(d.id)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:border-blue-500/40 hover:bg-[var(--secondary)]/50 hover:shadow-md transition-all duration-200",
                      loadingId === d.id && "opacity-60 pointer-events-none",
                      deletingId === d.id && "opacity-40 scale-95"
                    )}
                  >
                    {/* Type icon/badge */}
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold",
                        DIAGRAM_TYPE_COLORS[d.diagram_type] ||
                        "bg-gray-500/15 text-gray-400 border-gray-500/20"
                      )}
                    >
                      <Code2 className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)] group-hover:text-blue-500 transition-colors">
                        {d.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1 py-0 text-[10px] font-medium",
                            DIAGRAM_TYPE_COLORS[d.diagram_type] ||
                            "bg-gray-500/15 text-gray-400"
                          )}
                        >
                          {DIAGRAM_TYPE_LABELS[d.diagram_type as DiagramType] || d.diagram_type}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-[var(--muted)]">
                          <Clock className="h-2.5 w-2.5" />
                          {relativeTime(d.updated_at || d.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {loadingId === d.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, d.id)}
                          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-500/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Delete diagram"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {diagrams.length > 0 && (
          <div className="shrink-0 border-t border-[var(--border)] px-5 py-2.5 flex items-center justify-between">
            <p className="text-[10px] text-[var(--muted)]">
              {filteredDiagrams.length} of {diagrams.length} diagrams
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Click to open • Hover to delete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
