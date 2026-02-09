"use client";

import { useState } from "react";
import Canvas from "@/components/Canvas";
import { AppHeader } from "@/components/AppHeader";
import { LiveEditor } from "@/components/LiveEditor";

export default function Home() {
  const [viewMode, setViewMode] = useState<"generate" | "editor">("generate");
  const [editorCode, setEditorCode] = useState<string>("");

  const handleEditCode = (code: string) => {
    setEditorCode(code);
    setViewMode("editor");
  };

  return (
    <main
      className="flex h-screen w-screen flex-col overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--background)" }}
    >
      <AppHeader viewMode={viewMode} setViewMode={setViewMode} />
      <div className="flex h-full flex-1 flex-col overflow-hidden pt-14" style={{ minHeight: 0 }}>
        <div style={{ display: viewMode === "generate" ? "flex" : "none", width: "100%", height: "100%" }}>
          <Canvas onEditCode={handleEditCode} />
        </div>
        <div style={{ display: viewMode === "editor" ? "flex" : "none", width: "100%", height: "100%" }}>
          <LiveEditor initialCode={editorCode} />
        </div>
      </div>
    </main>
  );
}
