"use client";

import React, { useState, useEffect } from "react";
import { FolderOpen, Trash2, RefreshCw, X } from "lucide-react";
import { getDiagramsUrl, getDiagramUrl } from "@/lib/api";
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
  }) => void;
  className?: string;
}

export function DiagramsListPanel({
  isOpen,
  onClose,
  onLoad,
  className,
}: DiagramsListPanelProps) {
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagrams = async () => {
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
  };

  useEffect(() => {
    if (isOpen) fetchDiagrams();
  }, [isOpen]);

  const handleLoad = async (id: number) => {
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
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this diagram?")) return;
    try {
      const res = await fetch(getDiagramUrl(id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",
        className
      )}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-[var(--muted)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">My Diagrams</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchDiagrams}
              disabled={loading}
              className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-4 text-sm text-red-500">{error}</p>
          )}
          {loading && diagrams.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-[var(--muted)]" />
            </div>
          ) : diagrams.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--muted)]">
              No saved diagrams yet. Create one and click Save to store it.
            </div>
          ) : (
            <ul className="space-y-2">
              {diagrams.map((d) => (
                <li key={d.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLoad(d.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoad(d.id)}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--secondary)] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[var(--foreground)]">{d.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {d.diagram_type} • {d.updated_at ? new Date(d.updated_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, d.id)}
                      className="rounded p-1.5 text-[var(--muted)] hover:bg-red-500/20 hover:text-red-500"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
