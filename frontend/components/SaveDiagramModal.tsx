"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDiagramsUrl, getDiagramUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Node, Edge } from "@xyflow/react";

interface SaveDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (diagramId?: number) => void;
  diagramType: string;
  diagramCode: string | null;
  nodes: Node[];
  edges: Edge[];
  diagramPlan?: Record<string, unknown> | null;
  diagramId?: number | null;
  className?: string;
}

export function SaveDiagramModal({
  isOpen,
  onClose,
  onSaved,
  diagramType,
  diagramCode,
  nodes,
  edges,
  diagramPlan,
  diagramId,
  className,
}: SaveDiagramModalProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const payload = {
    mermaid: diagramCode,
    code: diagramCode,
    nodes,
    edges,
    diagram_type: diagramType,
    diagram_plan: diagramPlan,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const t = title.trim();
    if (!t) {
      setError("Please enter a title");
      return;
    }
    setLoading(true);
    try {
      const headers = { "Content-Type": "application/json", ...getAuthHeaders() };
      if (diagramId) {
        const res = await fetch(getDiagramUrl(diagramId), {
          method: "PUT",
          headers,
          body: JSON.stringify({ title: t, diagram_data: payload }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || "Update failed");
        }
        onSaved(diagramId);
      } else {
        const res = await fetch(getDiagramsUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: t,
            diagram_type: diagramType,
            diagram_data: payload,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || "Save failed");
        }
        const data = await res.json();
        onSaved(data.id);
      }
      onClose();
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
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
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {diagramId ? "Update diagram" : "Save diagram"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Auth flow"
              required
              className="bg-[var(--input)]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : diagramId ? "Update" : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}
