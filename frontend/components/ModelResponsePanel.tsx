"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, MessageSquare, Box, ArrowRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModelResponse {
  nodes: Array<{ id: string; type?: string; data?: { label?: string; subLabel?: string } }>;
  edges: Array<{ id: string; source: string; target: string; label?: React.ReactNode; data?: { label?: string } }>;
  explanation?: string;
}

interface ModelResponsePanelProps {
  response: ModelResponse | null;
  className?: string;
}

export function ModelResponsePanel({ response, className }: ModelResponsePanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={cn(
        "relative flex h-full shrink-0 flex-col border-l transition-all duration-300 ease-in-out",
        "border-[var(--panel-border)] bg-[var(--panel-bg)]",
        isExpanded ? "w-80" : "w-10",
        className
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          "absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-colors",
          "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        )}
        aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
        title={isExpanded ? "Collapse panel" : "Expand panel"}
      >
        {isExpanded ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Collapsed state - vertical text */}
      {!isExpanded && (
        <div className="flex h-full flex-col items-center justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex flex-col items-center gap-2 py-4 text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span 
              className="text-xs font-medium tracking-wider"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              Model Response
            </span>
            {response && (
              <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {response.nodes.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Expanded state */}
      {isExpanded && (
        <>
          <div className="border-b border-[var(--panel-border)] px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Model Response</h3>
                <p className="text-xs text-[var(--muted)]">What the model returned</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
            {!response ? (
              <p className="text-[var(--muted)]">Generate a diagram to see the model response here.</p>
            ) : (
              <div className="space-y-4">
                {response.explanation && (
                  <section>
                    <div className="flex items-center gap-1.5 text-[var(--primary)]">
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Explanation</span>
                    </div>
                    <p className="mt-1.5 text-[var(--foreground)] leading-relaxed">{response.explanation}</p>
                  </section>
                )}

                <section>
                  <div className="flex items-center gap-1.5 text-[var(--muted)]">
                    <Box className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Nodes</span>
                    <span className="text-xs text-[var(--muted)]">({response.nodes.length})</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {response.nodes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[var(--foreground)]"
                      >
                        <span className="font-mono text-xs text-[var(--muted)]">{n.id}</span>
                        <span className="block font-medium">
                          {n.data?.label ?? n.id}
                        </span>
                        {n.data?.subLabel && (
                          <span className="text-xs text-[var(--muted)]">{n.data.subLabel}</span>
                        )}
                        {n.type && (
                          <span className="ml-1 text-xs text-[var(--muted)]">({n.type})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <div className="flex items-center gap-1.5 text-[var(--muted)]">
                    <ArrowRight className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Edges</span>
                    <span className="text-xs text-[var(--muted)]">({response.edges.length})</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {response.edges.map((e) => {
                      const edgeLabel = e.data?.label || (typeof e.label === 'string' ? e.label : null);
                      return (
                        <li
                          key={e.id}
                          className="rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[var(--foreground)]"
                        >
                          <span className="font-mono text-xs text-[var(--muted)]">{e.source}</span>
                          <span className="mx-1 text-[var(--muted)]">→</span>
                          <span className="font-mono text-xs text-[var(--muted)]">{e.target}</span>
                          {edgeLabel && (
                            <span className="mt-0.5 block text-xs text-[var(--primary)]">{edgeLabel}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section>
                  <button
                    type="button"
                    onClick={() => setShowRaw((s) => !s)}
                    className="flex w-full items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--accent)]"
                  >
                    {showRaw ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    Raw JSON
                  </button>
                  {showRaw && (
                    <pre className="mt-1.5 max-h-48 overflow-auto rounded border border-[var(--border)] bg-[var(--card)] p-2 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  )}
                </section>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
