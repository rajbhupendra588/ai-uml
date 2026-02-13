"use client";

import React, { useState, useCallback, useRef } from "react";
import { MermaidDiagram, type DiagramTheme, DIAGRAM_THEMES } from "./MermaidDiagram";
import { useTheme } from "./ThemeProvider";
import { DiagramDownloadMenu } from "./DiagramDownloadMenu";
import { DiagramZoomControls } from "./DiagramZoomControls";
import {
  Code2,
  Sparkles,
  Copy,
  Check,
  Moon,
  Sun,
  FileCode,
  Paperclip,
  Settings,
  FileText,
  ImageIcon,
  MousePointer2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getGenerateUrl,
  getUpdateUrl,
  toValidDiagramType,
  type DiagramType,
  VALID_DIAGRAM_TYPES,
  DIAGRAM_TYPE_LABELS,
} from "@/lib/api";
import { getToken, getAuthHeaders } from "@/lib/auth";

const CODE_PLACEHOLDER = `# Paste your source code here
# Python, JavaScript, TypeScript, Java, etc.

def login(user, password):
    if validate(user, password):
        return create_session(user)
    return None`;

const PROMPT_PLACEHOLDER = "Describe the diagram (e.g. Create a flowchart, Show class structure)";
const UPDATE_PLACEHOLDER = "Update diagram (e.g. make it simpler, add more detail)";

const EXAMPLE_PROMPTS = [
  "Create a flowchart",
  "Architecture diagram with code snippets",
  "Class diagram",
  "Sequence diagram",
];

const CODE_TEMPLATES = [
  { name: "Login", code: `def login(user, password):\n    if validate(user, password):\n        return create_session(user)\n    return None` },
  { name: "API", code: `async function handleRequest(req) {\n  const auth = await authenticate(req);\n  if (!auth) return 401;\n  return { status: 200, body: await fetchData(req.params.id) };\n}` },
  { name: "Class", code: `class UserService {\n  async findById(id: string): Promise<User> {}\n  async create(user: User): Promise<User> {}\n}` },
];

export function CodeToDiagramEditor() {
  const { theme, toggleTheme } = useTheme();
  const [code, setCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>("flowchart");
  const [codeDetailLevel, setCodeDetailLevel] = useState<"small" | "complete">("complete");
  const [loading, setLoading] = useState(false);
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [versions, setVersions] = useState<Array<{ code: string; layout?: string }>>([]);
  const [showCodeView, setShowCodeView] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [look, setLook] = useState<"classic" | "handDrawn">("classic");
  const [diagramTheme, setDiagramTheme] = useState<DiagramTheme>("default");
  const [diagramFont, setDiagramFont] = useState<string>("Inter, sans-serif");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodeLabels, setSelectedNodeLabels] = useState<Record<string, string>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDiagram = !!diagramCode;

  const handleNodeClick = useCallback((nodeId: string, label?: string, ev?: MouseEvent) => {
    setSelectedNodeLabels((prev) => ({ ...prev, [nodeId]: label || nodeId }));
    setSelectedNodeIds((prev) => {
      const has = prev.includes(nodeId);
      if (ev?.ctrlKey || ev?.metaKey) {
        return has ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];
      }
      return has && prev.length === 1 ? [] : [nodeId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedNodeLabels({});
  }, []);
  const displayCode = versions[selectedVersionIndex]?.code ?? diagramCode ?? "";

  const handleGenerate = useCallback(async () => {
    const trimmedCode = (code || "").trim();
    const trimmedPrompt = (prompt || "").trim();
    if (!trimmedCode && !trimmedPrompt) {
      toast.error("Add code and/or a description");
      return;
    }

    const token = getToken();
    const isDev = process.env.NODE_ENV === "development";
    if (!token && !isDev) {
      const count = parseInt(localStorage.getItem("guest_diagram_count") || "0", 10);
      if (count >= 10) {
        toast.info("Sign up to create more diagrams!");
        return;
      }
      localStorage.setItem("guest_diagram_count", (count + 1).toString());
    }

    const fullPrompt = trimmedCode
      ? `Generate a diagram from this code. ${trimmedPrompt ? `Description: ${trimmedPrompt}` : "Include relevant code snippets."}\n\nCode:\n\`\`\`\n${trimmedCode.slice(0, 8000)}\n\`\`\``
      : trimmedPrompt;

    setLoading(true);
    try {
      const response = await fetch(getGenerateUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          prompt: fullPrompt,
          diagram_type: toValidDiagramType(diagramType),
          model: null,
          code_detail_level: codeDetailLevel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(typeof data.detail === "string" ? data.detail : "Generation failed");
        return;
      }
      const mermaidCode = data.mermaid ?? "";
      setVersions(data.versions ?? []);
      setSelectedVersionIndex(0);
      setDiagramCode(mermaidCode || null);
      setSelectedNodeIds([]);
      setSelectedNodeLabels({});
      if (mermaidCode) toast.success("Diagram generated");
      else toast.warning("No diagram returned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [code, prompt, diagramType, codeDetailLevel]);

  const handleUpdate = useCallback(async () => {
    const trimmedPrompt = (prompt || "").trim();
    if (!trimmedPrompt || !diagramCode) {
      toast.error("Enter what you want to change");
      return;
    }
    const selectionContext = selectedNodeIds.length > 0
      ? `[User selected node(s): ${selectedNodeIds.map((id) => selectedNodeLabels[id] || id).join(", ")}]\n\n`
      : "";
    const fullPrompt = selectionContext + trimmedPrompt;
    setLoading(true);
    try {
      const response = await fetch(getUpdateUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          prompt: fullPrompt,
          current_mermaid: diagramCode,
          model: null,
          code_detail_level: codeDetailLevel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(typeof data.detail === "string" ? data.detail : "Update failed");
        return;
      }
      const updated = data.mermaid ?? diagramCode;
      setDiagramCode(updated);
      setVersions([{ code: updated, layout: "Updated" }]);
      setSelectedVersionIndex(0);
      setSelectedNodeIds([]);
      setSelectedNodeLabels({});
      toast.success("Diagram updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [diagramCode, prompt, codeDetailLevel, selectedNodeIds, selectedNodeLabels]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    hasDiagram ? handleUpdate() : handleGenerate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCode(reader.result as string);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !/\.(py|js|ts|tsx|jsx|java|go|rb|php|cpp|c|cs|rs|r|sql|sh)$/i.test(file.name)) {
      if (file) toast.error("Drop a code file (.py, .js, .ts, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(reader.result as string);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleCopyCode = async () => {
    if (!diagramCode) return;
    try {
      await navigator.clipboard.writeText(diagramCode);
      setCopying(true);
      toast.success("Copied");
      setTimeout(() => setCopying(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // ... existing code ...

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col bg-[var(--background)]">
      {/* Minimal header */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Code2 className="h-4 w-4 text-indigo-500" />
            Code to Diagram
          </h1>
          {/* ... existing header controls ... */}
          <select
            value={diagramType}
            onChange={(e) => setDiagramType(e.target.value as DiagramType)}
            className="h-8 rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {VALID_DIAGRAM_TYPES.filter((t) => t !== "chat").map((t) => (
              <option key={t} value={t}>{DIAGRAM_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
            {(["small", "complete"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setCodeDetailLevel(level)}
                className={cn(
                  "px-2 py-1 text-xs font-medium capitalize",
                  codeDetailLevel === level ? "bg-indigo-500 text-white" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                )}
              >
                {level}
              </button>
            ))}
          </div>
          {versions.length > 1 && (
            <select
              value={selectedVersionIndex}
              onChange={(e) => setSelectedVersionIndex(parseInt(e.target.value, 10))}
              className="h-8 rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:outline-none"
            >
              {versions.map((v, i) => (
                <option key={i} value={i}>{v.layout ?? `Layout ${i + 1}`}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* ... other header buttons ... */}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl z-50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Theme</span>
                    <select
                      value={diagramTheme}
                      onChange={(e) => setDiagramTheme(e.target.value as DiagramTheme)}
                      className="h-7 rounded border border-[var(--input)] bg-[var(--background)] px-2 text-xs"
                    >
                      {Object.keys(DIAGRAM_THEMES).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Style</span>
                    <button
                      onClick={() => setLook((l) => (l === "classic" ? "handDrawn" : "classic"))}
                      className="rounded border border-[var(--input)] px-2 py-1 text-xs"
                    >
                      {look === "classic" ? "Classic" : "Hand-drawn"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>3D</span>
                    <button
                      onClick={() => setIs3D((p) => !p)}
                      className={cn("rounded border px-2 py-1 text-xs", is3D ? "border-indigo-500 bg-indigo-500/10" : "border-[var(--input)]")}
                    >
                      {is3D ? "On" : "Off"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {diagramCode && (
            <>
              <button
                onClick={() => setShowCodeView((v) => !v)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border hover:bg-[var(--secondary)]",
                  showCodeView ? "border-indigo-500 bg-indigo-500/10 text-indigo-500" : "border-[var(--border)] text-[var(--muted-foreground)]"
                )}
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={handleCopyCode}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
              >
                {copying ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <DiagramDownloadMenu
                containerRef={previewRef}
                diagramType={diagramType}
                nodes={[]}
                edges={[]}
                diagramCode={diagramCode}
                onPrepareExport={async (fn) => await fn()}
              />
            </>
          )}
        </div>
      </header>

      {/* 50/50 split */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Code input */}
        <div
          id="c2d-code-input"
          className={cn(
            "flex flex-col w-1/2 min-w-0 border-r border-[var(--border)]",
            isDragging && "bg-indigo-500/5"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div id="c2d-templates" className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--secondary)]/50">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Code</span>
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".py,.js,.ts,.tsx,.jsx,.java,.go,.rb,.php,.cpp,.c,.cs,.rs,.r,.sql,.sh,.md,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  <Paperclip className="h-3 w-3" />
                  Attach
                </button>
                {CODE_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => { setCode(t.code); toast.success("Loaded"); }}
                    className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={CODE_PLACEHOLDER}
              className="flex-1 min-h-0 w-full resize-none p-4 font-mono text-sm leading-relaxed bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className="shrink-0 p-4 border-t border-[var(--border)] bg-[var(--card)] space-y-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                id="c2d-prompt-input"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={hasDiagram ? (selectedNodeIds.length > 0 ? `Update selected: ${selectedNodeIds.map((id) => selectedNodeLabels[id] || id).join(", ")}` : UPDATE_PLACEHOLDER) : PROMPT_PLACEHOLDER}
                className="flex-1 min-w-0 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                id="c2d-generate-btn"
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Code2 className="h-4 w-4" />}
                {loading ? "..." : hasDiagram ? "Update" : "Generate"}
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  disabled={loading}
                  className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs text-[var(--muted-foreground)] hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Diagram */}
        <div id="c2d-diagram-area" className="flex flex-1 flex-col min-w-0 bg-[var(--background)]">
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--secondary)]/50">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Diagram</span>
            <div className="flex items-center gap-2">
              {hasDiagram && selectedNodeIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <MousePointer2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs text-[var(--foreground)]">
                    {selectedNodeIds.length} selected: {selectedNodeIds.map((id) => selectedNodeLabels[id] || id).join(", ")}
                  </span>
                  <button
                    onClick={clearSelection}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                    title="Clear selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {hasDiagram && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowCodeView(false)}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1 text-xs",
                      !showCodeView ? "bg-indigo-500/20 text-indigo-500" : "hover:bg-[var(--accent)]"
                    )}
                  >
                    <ImageIcon className="h-3 w-3" />
                    View
                  </button>
                  <button
                    onClick={() => setShowCodeView(true)}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1 text-xs",
                      showCodeView ? "bg-indigo-500/20 text-indigo-500" : "hover:bg-[var(--accent)]"
                    )}
                  >
                    <FileText className="h-3 w-3" />
                    Code
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden bg-[var(--canvas)] relative" ref={previewRef}>
            {showCodeView && diagramCode ? (
              <div className="h-full overflow-auto p-4">
                <pre className="font-mono text-sm text-[var(--foreground)] whitespace-pre-wrap">
                  <code>{displayCode}</code>
                </pre>
              </div>
            ) : diagramCode ? (
              <MermaidDiagram
                code={displayCode}
                className="h-full w-full"
                is3D={is3D}
                look={look}
                diagramTheme={diagramTheme}
                fontFamily={diagramFont}
                onNodeClick={handleNodeClick}
                selectedNodeIds={selectedNodeIds}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-8">
                <FileCode className="h-12 w-12 text-[var(--muted)]/40 mb-4" />
                <p className="text-sm font-medium text-[var(--foreground)]">Diagram preview</p>
                <p className="mt-1 text-xs text-[var(--muted)] max-w-[240px]">
                  Paste code on the left, add a description, and click Generate
                </p>
              </div>
            )}
            {diagramCode && !showCodeView && (
              <p className="absolute bottom-2 left-4 text-[10px] text-[var(--muted)] z-10 pointer-events-none">
                Click nodes to select · Ctrl+click for multiple
              </p>
            )}
            <DiagramZoomControls containerRef={previewRef} visible={!!diagramCode && !showCodeView} />
          </div>
        </div>
      </div>
    </div>
  );
}
