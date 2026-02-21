"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Canvas from "@/components/Canvas";
import { AppHeader, type ViewMode } from "@/components/AppHeader";
import { LiveEditor } from "@/components/LiveEditor";
import { CodeToDiagramEditor } from "@/components/CodeToDiagramEditor";
import { CompleteTour } from "@/components/CompleteTour";
import { useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";
import { getDiagramUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import type { Node, Edge } from "@xyflow/react";

interface InitialDiagram {
  diagramCode: string | null;
  nodes: Node[];
  edges: Edge[];
  diagramType: string;
  diagramPlan?: Record<string, unknown> | null;
  diagramId?: number;
  title?: string;
}

function EditorContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("generate");
  const [editorCode, setEditorCode] = useState<string>("");
  const [startTour, setStartTour] = useState(false);
  const [initialDiagram, setInitialDiagram] = useState<InitialDiagram | null>(null);
  const [loadingDiagram, setLoadingDiagram] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/editor");
      return;
    }
  }, [user, authLoading, router]);

  // Load diagram from URL query parameter ?diagram=<id>
  useEffect(() => {
    if (authLoading || !user) return;
    const diagramId = searchParams.get("diagram");
    if (!diagramId) return;

    const id = parseInt(diagramId, 10);
    if (isNaN(id)) return;

    setLoadingDiagram(true);
    fetch(getDiagramUrl(id), { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load diagram");
        return res.json();
      })
      .then((d) => {
        const data = d.diagram_data || {};
        const code = d.mermaid_code || data.mermaid || data.code || null;
        const nodes = (data.nodes || []) as Node[];
        const edges = (data.edges || []) as Edge[];
        setInitialDiagram({
          diagramCode: code,
          nodes,
          edges,
          diagramType: d.diagram_type || "architecture",
          diagramPlan: data.diagram_plan || null,
          diagramId: id,
          title: d.title,
        });

        // Clean up URL without reloading the page
        const url = new URL(window.location.href);
        url.searchParams.delete("diagram");
        window.history.replaceState({}, "", url.pathname);
      })
      .catch((err) => {
        console.error("Failed to load diagram from URL:", err);
      })
      .finally(() => {
        setLoadingDiagram(false);
      });
  }, [authLoading, user, searchParams]);

  const handleEditCode = (code: string) => {
    setEditorCode(code);
    setViewMode("editor");
  };

  const handleStartTour = useCallback(() => {
    localStorage.removeItem("has_seen_complete_tour");
    setStartTour(true);
  }, []);

  const handleTourEnd = useCallback(() => {
    setStartTour(false);
  }, []);

  if (authLoading || !user) {
    return (
      <main
        className="flex h-screen w-screen flex-col items-center justify-center"
        style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {authLoading ? "Loading..." : "Redirecting to sign in..."}
        </p>
      </main>
    );
  }

  if (loadingDiagram) {
    return (
      <main
        className="flex h-screen w-screen flex-col items-center justify-center"
        style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Loading diagram...
        </p>
      </main>
    );
  }

  return (
    <main
      className="flex h-screen w-screen flex-col overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--background)" }}
    >
      <AppHeader viewMode={viewMode} setViewMode={setViewMode} onStartTour={handleStartTour} />
      <div className="flex h-full flex-1 flex-col overflow-hidden pt-14" style={{ minHeight: 0 }}>
        <div style={{ display: viewMode === "generate" ? "flex" : "none", width: "100%", height: "100%" }}>
          <Canvas onEditCode={handleEditCode} initialDiagram={initialDiagram} />
        </div>
        <div style={{ display: viewMode === "editor" ? "flex" : "none", width: "100%", height: "100%" }}>
          <LiveEditor initialCode={editorCode} />
        </div>
        <div style={{ display: viewMode === "codeToDiagram" ? "flex" : "none", width: "100%", height: "100%" }}>
          <CodeToDiagramEditor />
        </div>
      </div>
      <CompleteTour setViewMode={setViewMode} startTour={startTour} onTourEnd={handleTourEnd} />
    </main>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex h-screen w-screen flex-col items-center justify-center"
          style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} />
        </main>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
