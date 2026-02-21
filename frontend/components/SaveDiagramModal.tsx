"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDiagramsUrl, getDiagramUrl, DIAGRAM_TYPE_LABELS } from "@/lib/api";
import type { DiagramType } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { sanitizeMermaidCode } from "@/lib/sanitizeMermaid";
import type { Node, Edge } from "@xyflow/react";

interface SaveDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (diagramId?: number, title?: string) => void;
  diagramType: string;
  diagramCode: string | null;
  nodes: Node[];
  edges: Edge[];
  diagramPlan?: Record<string, unknown> | null;
  diagramId?: number | null;
  existingTitle?: string | null;
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
  existingTitle,
  className,
}: SaveDiagramModalProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fill title when editing existing diagram
  useEffect(() => {
    if (isOpen) {
      if (existingTitle && diagramId) {
        setTitle(existingTitle);
      } else {
        setTitle("");
      }
      setError(null);
      setSuccess(false);
      setSaveAsNew(false);
      // Auto-focus the input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, existingTitle, diagramId]);

  const safeMermaid = diagramCode != null ? sanitizeMermaidCode(diagramCode) : null;
  const payload = {
    mermaid: safeMermaid,
    code: safeMermaid,
    nodes,
    edges,
    diagram_type: diagramType,
    diagram_plan: diagramPlan,
  };

  const isUpdate = !!diagramId && !saveAsNew;
  const diagramLabel = DIAGRAM_TYPE_LABELS[diagramType as DiagramType] || diagramType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const t = title.trim();
    if (!t) {
      setError("Please enter a title");
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const headers = { "Content-Type": "application/json", ...getAuthHeaders() };
      if (isUpdate) {
        const res = await fetch(getDiagramUrl(diagramId!), {
          method: "PUT",
          headers,
          body: JSON.stringify({ title: t, diagram_data: payload }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || "Update failed");
        }
        setSuccess(true);
        setTimeout(() => {
          onSaved(diagramId!, t);
          onClose();
        }, 600);
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
        setSuccess(true);
        setTimeout(() => {
          onSaved(data.id, t);
          onClose();
          setTitle("");
        }, 600);
      }
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
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
        className
      )}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              success
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-blue-500/15 text-blue-500"
            )}>
              {success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Save className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {success ? "Saved!" : isUpdate ? "Update Diagram" : "Save Diagram"}
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                {diagramLabel} diagram
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Diagram stats */}
        <div className="mx-5 mb-3 flex gap-2">
          <div className="flex-1 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">Type</p>
            <p className="text-xs font-semibold text-[var(--foreground)] mt-0.5">{diagramLabel}</p>
          </div>
          {safeMermaid && (
            <div className="flex-1 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">Lines</p>
              <p className="text-xs font-semibold text-[var(--foreground)] mt-0.5">
                {safeMermaid.split("\n").length}
              </p>
            </div>
          )}
          {nodes.length > 0 && (
            <div className="flex-1 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">Nodes</p>
              <p className="text-xs font-semibold text-[var(--foreground)] mt-0.5">{nodes.length}</p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Diagram Title
            </label>
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Auth flow, User registration, Payment system..."
              required
              maxLength={255}
              className={cn(
                "bg-[var(--input)] transition-all",
                error && "border-red-500 focus:ring-red-500/20"
              )}
            />
            <div className="mt-1 flex items-center justify-between">
              <div>
                {error && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </p>
                )}
              </div>
              <p className="text-[10px] text-[var(--muted)]">
                {title.length}/255
              </p>
            </div>
          </div>

          {/* Save as new toggle for existing diagrams */}
          {diagramId && (
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className={cn(
                "relative h-5 w-9 rounded-full transition-colors duration-200",
                saveAsNew ? "bg-blue-500" : "bg-[var(--secondary)]"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  saveAsNew ? "translate-x-4" : "translate-x-0.5"
                )} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                <Copy className="h-3.5 w-3.5" />
                Save as new copy
              </div>
            </label>
          )}

          <Button
            type="submit"
            className={cn(
              "w-full font-medium transition-all",
              success && "bg-emerald-600 hover:bg-emerald-700"
            )}
            disabled={loading || success}
          >
            {success ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Saved successfully
              </span>
            ) : loading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {isUpdate ? "Updating..." : "Saving..."}
              </span>
            ) : isUpdate ? (
              "Update Diagram"
            ) : (
              "Save Diagram"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
