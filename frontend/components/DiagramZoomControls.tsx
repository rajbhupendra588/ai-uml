"use client";

import React from "react";

interface DiagramZoomControlsProps {
  /** Ref to the container that holds the SVG (e.g. previewRef with MermaidDiagram inside) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional: hide controls (e.g. when no diagram to zoom) */
  visible?: boolean;
}

export function DiagramZoomControls({ containerRef, visible = true }: DiagramZoomControlsProps) {
  const zoomIn = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const cur = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || "1");
    const next = Math.min(cur + 0.15, 3);
    svg.style.transform = `scale(${next})`;
    svg.style.transformOrigin = "center center";
  };

  const zoomOut = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const cur = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || "1");
    const next = Math.max(cur - 0.15, 0.3);
    svg.style.transform = `scale(${next})`;
    svg.style.transformOrigin = "center center";
  };

  const resetZoom = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    svg.style.transform = "scale(1)";
  };

  if (!visible) return null;

  return (
    <div
      data-diagram-download-hide
      className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
    >
      <button
        type="button"
        onClick={zoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button
        type="button"
        onClick={zoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button
        type="button"
        onClick={resetZoom}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        1:1
      </button>
    </div>
  );
}
