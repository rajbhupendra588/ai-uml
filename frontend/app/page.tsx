"use client";

import { useState, useCallback } from "react";
import Canvas from "@/components/Canvas";
import { AppHeader, type ViewMode } from "@/components/AppHeader";
import { LiveEditor } from "@/components/LiveEditor";
import { CodeToDiagramEditor } from "@/components/CodeToDiagramEditor";
import { CompleteTour } from "@/components/CompleteTour";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("generate");
  const [editorCode, setEditorCode] = useState<string>("");
  const [startTour, setStartTour] = useState(false);

  const handleEditCode = (code: string) => {
    setEditorCode(code);
    setViewMode("editor");
  };

  const handleStartTour = useCallback(() => {
    // Clear tour state and trigger restart
    localStorage.removeItem("has_seen_complete_tour");
    setStartTour(true);
  }, []);

  const handleTourEnd = useCallback(() => {
    setStartTour(false);
  }, []);

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
