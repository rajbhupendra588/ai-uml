"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Canvas from "@/components/Canvas";
import { AppHeader, type ViewMode } from "@/components/AppHeader";
import { LiveEditor } from "@/components/LiveEditor";
import { CodeToDiagramEditor } from "@/components/CodeToDiagramEditor";
import { CompleteTour } from "@/components/CompleteTour";
import { useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";

export default function EditorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("generate");
  const [editorCode, setEditorCode] = useState<string>("");
  const [startTour, setStartTour] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/editor");
      return;
    }
  }, [user, authLoading, router]);

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

  return (
    <main
      className="flex h-screen w-screen flex-col overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--background)" }}
    >
      <AppHeader viewMode={viewMode} setViewMode={setViewMode} onStartTour={handleStartTour} />
      <div className="flex h-full flex-1 flex-col overflow-hidden pt-14" style={{ minHeight: 0 }}>
        <div style={{ display: viewMode === "generate" ? "flex" : "none", width: "100%", height: "100%" }}>
          <Canvas onEditCode={handleEditCode} />
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
