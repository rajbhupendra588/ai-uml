"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { DiagramZoomControls } from "@/components/DiagramZoomControls";
import { getShareDiagramUrl } from "@/lib/api";

export default function SharePage() {
  const params = useParams();
  const shareId = (params?.id as string) ?? null;
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    fetch(getShareDiagramUrl(shareId))
      .then((res) => {
        if (!res.ok) throw new Error("Diagram not found or expired");
        return res.json();
      })
      .then((data) => {
        setMermaidCode(data.mermaid_code ?? "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load diagram");
      })
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading || !shareId) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">Loading shared diagram...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-center justify-center gap-6"
        style={{ backgroundColor: "var(--background)" }}
      >
        <p className="text-sm text-amber-500">{error}</p>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: "var(--background)" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ArchitectAI
        </Link>
        <span className="text-xs text-[var(--muted)]">Shared diagram</span>
      </header>

      <div
        ref={containerRef}
        className="relative flex flex-1 min-h-0 overflow-hidden"
      >
        {mermaidCode && (
          <MermaidDiagram
            code={mermaidCode}
            className="flex-1"
          />
        )}
        <DiagramZoomControls
          containerRef={containerRef}
          visible={!!mermaidCode}
        />
      </div>
    </div>
  );
}
