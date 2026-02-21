"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import HardwareNode from "./HardwareNode";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { DiagramTypeSelector } from "./DiagramTypeSelector";
import { ModelSelector } from "./ModelSelector";
import { DiagramDownloadMenu } from "./DiagramDownloadMenu";
import { DiagramZoomControls } from "./DiagramZoomControls";
import { EditNodePanel, type EditingNode } from "./EditNodePanel";
import { DiagramControlsPanel } from "./DiagramControlsPanel";
import { MermaidStyleEdge, MermaidBezierEdge } from "./MermaidStyleEdge";
import {
  ClassNode,
  LifelineNode,
  SequenceMessageNode,
  ActorNode,
  UseCaseNode,
  ActivityNode,
  StateNode,
  ComponentNode,
  DeploymentNode,
  ArtifactNode,
} from "./uml";
import {
  getGenerateUrl,
  getUpdateUrl,
  getGenerateFromRepoUrl,
  getPlanUrl,
  getGenerateFromPlanUrl,
  getModelsUrl,
  DEFAULT_MODELS,
  toValidDiagramType,
  type ModelOption,
} from "@/lib/api";
import type { DiagramType } from "@/lib/api";
import { type ModelResponse } from "./ModelResponsePanel";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./ThemeProvider";
import { MermaidDiagram, type DiagramTheme, DIAGRAM_THEMES } from "./MermaidDiagram";
import { SideKick, SideKickToggle, type ContextMessage } from "./SideKick";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
export interface DiagramVersion {
  code: string;
  layout: string;
  direction: string;
  description: string;
}
import { Sparkles, FilePlus2, Save, FolderOpen, Pencil, Palette, Code2 } from "lucide-react";
import { SaveDiagramModal } from "./SaveDiagramModal";
import { DiagramsListPanel } from "./DiagramsListPanel";
import { getAuthHeaders, getToken } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { SignupModal } from "@/components/auth/SignupModal";
import { EntityEditPopup } from "./EntityEditPopup";
import { updateNodeLabel } from "@/lib/updateMermaidNode";

const EMPTY_NODES: Node[] = [];
const MAX_UNDO_HISTORY = 50;

type HistorySnapshot = { nodes: Node[]; edges: Edge[] };

function cloneSnapshot(nodes: Node[], edges: Edge[]): HistorySnapshot {
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

/** Listens to keyboard and calls callbacks; must be rendered inside ReactFlow to use fitView. */
function CanvasKeyboardShortcuts({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onNewDiagram,
  onOpenExport,
  onToggleSidebar,
  onShowHelp,
  onCloseOverlays,
  onSave,
}: {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onNewDiagram: () => void;
  onOpenExport: () => void;
  onToggleSidebar: () => void;
  onShowHelp: () => void;
  onCloseOverlays?: () => void;
  onSave?: () => void;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.("input, textarea, [contenteditable='true']")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) onRedo();
        } else {
          if (canUndo) onUndo();
        }
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        fitView?.();
        return;
      }
      if (mod && e.key === "n") {
        e.preventDefault();
        onNewDiagram();
        return;
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        onOpenExport();
        return;
      }
      if (mod && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (mod && e.key === "2") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onShowHelp();
        return;
      }
      if (e.key === "Escape") {
        onCloseOverlays?.();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    fitView,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onNewDiagram,
    onOpenExport,
    onToggleSidebar,
    onShowHelp,
    onCloseOverlays,
    onSave,
  ]);
  return null;
}

/** Summarize diagram plan for preview. */
function summarizePlan(plan: Record<string, unknown>, diagramType: DiagramType): string {
  if (diagramType === "architecture") {
    const comps = plan.components as Array<{ name?: string }> | undefined;
    if (Array.isArray(comps) && comps.length) {
      return comps.map((c) => c.name || "?").join(", ");
    }
  }
  if (diagramType === "hld") {
    const layers = plan.layers as Record<string, Array<{ name?: string }>> | undefined;
    if (layers && typeof layers === "object") {
      const parts: string[] = [];
      for (const [layer, items] of Object.entries(layers)) {
        if (Array.isArray(items) && items.length) {
          parts.push(`${layer}: ${items.map((i) => i.name || "?").join(", ")}`);
        }
      }
      if (parts.length) return parts.join(" · ");
    }
  }

  if (diagramType === "usecase") {
    const actors = plan.actors as Array<{ name?: string }> | undefined;
    const useCases = plan.useCases as Array<{ name?: string }> | undefined;
    const a = Array.isArray(actors) && actors.length ? actors.map((x) => x.name || "?").join(", ") : "";
    const u = Array.isArray(useCases) && useCases.length ? useCases.map((x) => x.name || "?").join(", ") : "";
    if (a || u) return [a, u].filter(Boolean).join(" · ");
  }
  if (diagramType === "class") {
    const classes = plan.classes as Array<{ name?: string }> | undefined;
    if (Array.isArray(classes) && classes.length) {
      return classes.map((c) => c.name || "?").join(", ");
    }
  }
  if (diagramType === "sequence") {
    const participants = plan.participants as Array<{ name?: string; id?: string }> | undefined;
    if (Array.isArray(participants) && participants.length) {
      return participants.map((p) => p.name || p.id || "?").join(" → ");
    }
  }
  if (diagramType === "chat") {
    return (plan.prompt as string) || "General Query";
  }
  return "Plan ready";
}

/** Build node ID -> full code map for per-node expand popover. */
function buildNodeCodeMap(plan: Record<string, unknown> | null, diagramType: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!plan) return map;

  const code = (obj: unknown): string | undefined =>
    (obj && typeof obj === "object" && ("code" in obj || "snippet" in obj))
      ? (String((obj as Record<string, unknown>).code || (obj as Record<string, unknown>).snippet || "").trim() || undefined)
      : undefined;

  if (diagramType === "architecture") {
    const comps = plan.components as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(comps)) {
      comps.forEach((c, i) => {
        const cde = code(c);
        if (cde) map[`n${i}`] = cde;
      });
    }
  } else if (diagramType === "hld") {
    const layers = plan.layers as Record<string, Array<Record<string, unknown>>> | undefined;
    if (layers && typeof layers === "object") {
      let idx = 0;
      for (const items of Object.values(layers)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            const cde = code(item);
            if (cde) map[`n${idx}`] = cde;
            idx++;
          }
        }
      }
    }
  } else if (diagramType === "flowchart" || diagramType === "activity") {
    const nodes = plan.nodes as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(nodes)) {
      nodes.forEach((n) => {
        const id = (n.id as string) || "";
        const safe = id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 25) || "n0";
        const cde = code(n);
        if (cde) map[safe] = cde;
      });
    }
  } else if (diagramType === "state") {
    const states = plan.states as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(states)) {
      states.forEach((s) => {
        const id = (s.id as string) || "";
        const safe = id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30) || "s0";
        const cde = code(s);
        if (cde) map[safe] = cde;
      });
    }
  } else if (diagramType === "component") {
    const comps = plan.components as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(comps)) {
      comps.forEach((c) => {
        const id = (c.id as string) || (c.name as string) || "";
        const safe = id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30) || "c0";
        const cde = code(c);
        if (cde) map[safe] = cde;
      });
    }
  }
  return map;
}

export interface CanvasProps {
  onEditCode?: (code: string) => void;
  initialDiagram?: {
    diagramCode: string | null;
    nodes: import("@xyflow/react").Node[];
    edges: import("@xyflow/react").Edge[];
    diagramType: string;
    diagramPlan?: Record<string, unknown> | null;
    diagramId?: number;
    title?: string;
  } | null;
}

function CanvasInner({ onEditCode, initialDiagram }: CanvasProps) {
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(EMPTY_NODES);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);
  const [diagramType, setDiagramType] = useState<DiagramType>("architecture");
  const [planFirstMode, setPlanFirstMode] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{
    diagram_plan: Record<string, unknown>;
    diagram_type: DiagramType;
    prompt: string;
  } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [modelResponse, setModelResponse] = useState<ModelResponse | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODELS[0]?.id ?? "arcee-ai/trinity-large-preview:free");
  const [isExporting, setIsExporting] = useState(false);
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<EditingNode | null>(null);
  const [showSideKick, setShowSideKick] = useState(true);
  const [contextMessages, setContextMessages] = useState<ContextMessage[]>([]);
  const [diagramVersions, setDiagramVersions] = useState<DiagramVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [diagramPlan, setDiagramPlan] = useState<Record<string, unknown> | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [newDiagramCount, setNewDiagramCount] = useState(0);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [diagramsPanelOpen, setDiagramsPanelOpen] = useState(false);
  const [savedDiagramId, setSavedDiagramId] = useState<number | null>(null);
  const [savedDiagramTitle, setSavedDiagramTitle] = useState<string | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  // Undo/redo history (only for React Flow canvas; not for Mermaid view)
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const [is3D, setIs3D] = useState(false);
  const [look, setLook] = useState<"classic" | "handDrawn">("classic");
  const [diagramTheme, setDiagramTheme] = useState<DiagramTheme>("default");
  const [diagramFont, setDiagramFont] = useState<string>("Inter, sans-serif");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [diagramControlsOpen, setDiagramControlsOpen] = useState(true);

  // Entity editing state
  const [editingEntity, setEditingEntity] = useState<{
    id: string;
    label: string;
    position: { x: number; y: number };
    styles?: {
      fontFamily?: string;
      fontSize?: string;
      fill?: string;
      stroke?: string;
    };
  } | null>(null);

  // Advanced Styling State
  const [edgeCurve, setEdgeCurve] = useState("monotoneX");
  const [spacing, setSpacing] = useState<"compact" | "normal" | "wide">("normal");
  const [backgroundPattern, setBackgroundPattern] = useState<"dots" | "lines" | "cross" | "none">("dots");
  const [layoutDirection, setLayoutDirection] = useState("TD");
  const [canvasLayout, setCanvasLayout] = useState<"auto" | "adaptive" | "horizontal">("auto");

  const [customColors, setCustomColors] = useState<{
    nodeColor?: string;
    edgeColor?: string;
    textColor?: string;
    bgColor?: string;
  }>({});
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const skipNextPushRef = useRef(false);
  const lastPromptRef = useRef<string>("");
  const flowContainerRef = useRef<HTMLDivElement>(null);

  // Close theme menu when clicking outside
  useEffect(() => {
    if (!themeMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as globalThis.Node)) {
        setThemeMenuOpen(false);
      }
    };

    // Add a small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [themeMenuOpen]);

  useEffect(() => {
    fetch(getModelsUrl())
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models) && d.models.length > 0) {
          setModelOptions(d.models);
          if (d.default) setSelectedModel(d.default);
        }
      })
      .catch(() => { });
  }, []);

  // Restore persisted state from localStorage
  useLayoutEffect(() => {
    const loadUserSpecificData = async () => {
      try {
        const sidebar = localStorage.getItem("showSideKick");
        const lastUserId = localStorage.getItem("lastUserId");

        if (sidebar !== null) setShowSideKick(sidebar === "true");

        // Get current user to check if it's the same user
        const { fetchUser } = await import("@/lib/auth");
        const currentUser = await fetchUser();
        const currentUserId = currentUser?.id?.toString() || null;

        // If different user, clear messages
        if (lastUserId && currentUserId && lastUserId !== currentUserId) {
          localStorage.removeItem("contextMessages");
          localStorage.setItem("lastUserId", currentUserId);
          setContextMessages([]);
          return;
        }

        // If same user or first time, store user ID and load messages
        if (currentUserId) {
          localStorage.setItem("lastUserId", currentUserId);
        }

        const raw = localStorage.getItem("contextMessages");
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ id: string; role: string; content: string; timestamp: string; diagramType?: string }>;
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContextMessages(
              parsed.map((m) => ({
                ...m,
                role: m.role as "user" | "assistant",
                timestamp: new Date(m.timestamp),
              }))
            );
          }
        }
      } catch {
        // ignore
      }
    };

    loadUserSpecificData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("showSideKick", String(showSideKick));
    } catch { /* ignore */ }
  }, [showSideKick]);

  // Persist context messages (cap at 50)
  useEffect(() => {
    if (contextMessages.length === 0) return;
    try {
      const toStore = contextMessages.slice(-50).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem("contextMessages", JSON.stringify(toStore));
    } catch { /* ignore */ }
  }, [contextMessages]);

  const pushPast = useCallback(() => {
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    setPast((prev) => [...prev, cloneSnapshot(nodes, edges)].slice(-MAX_UNDO_HISTORY));
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      skipNextPushRef.current = true;
      setFuture((f) => [...f, cloneSnapshot(nodes, edges)]);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      toast.success("Undo");
      return p.slice(0, -1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      skipNextPushRef.current = true;
      setPast((p) => [...p, cloneSnapshot(nodes, edges)]);
      setNodes(next.nodes);
      setEdges(next.edges);
      toast.success("Redo");
      return f.slice(0, -1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  const handleNewDiagram = useCallback(() => {
    setDiagramCode(null);
    setNodes(EMPTY_NODES);
    setEdges([]);
    setPast([]);
    setFuture([]);
    setEditingNode(null);
    setPendingPlan(null);
    setDiagramVersions([]);
    setSelectedVersionIndex(0);
    setDiagramPlan(null);
    setExplanation(null);
    setModelResponse(null);
    setModelThinking(null);
    setNewDiagramCount((c) => c + 1); // Clears GitHub repos panel cache
    setSavedDiagramId(null);
    setSavedDiagramTitle(null);
    setCustomColors({});
    toast.success("New diagram");
  }, [setNodes, setEdges]);

  const handleLoadDiagram = useCallback(
    (data: {
      diagramCode: string | null;
      nodes: Node[];
      edges: Edge[];
      diagramType: string;
      diagramPlan?: Record<string, unknown> | null;
      diagramId?: number;
      title?: string;
    }) => {
      setDiagramCode(data.diagramCode);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setDiagramType(data.diagramType as DiagramType);
      setDiagramPlan(data.diagramPlan || null);
      setSavedDiagramId(data.diagramId ?? null);
      setSavedDiagramTitle(data.title ?? null);
      setPast([]);
      setFuture([]);
      toast.success("Diagram loaded");
    },
    [setNodes, setEdges]
  );

  // Auto-load initial diagram passed from URL query params
  const initialDiagramLoadedRef = useRef(false);
  useEffect(() => {
    if (initialDiagram && !initialDiagramLoadedRef.current) {
      initialDiagramLoadedRef.current = true;
      handleLoadDiagram(initialDiagram);
    }
  }, [initialDiagram, handleLoadDiagram]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      const hasRemove = changes.some((c: { type?: string }) => c.type === "remove");
      if (hasRemove) pushPast();
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase, pushPast]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      const hasRemove = changes.some((c: { type?: string }) => c.type === "remove");
      if (hasRemove) pushPast();
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase, pushPast]
  );

  const { theme } = useTheme();

  const nodeTypes = useMemo(
    () => ({
      hardware: HardwareNode,
      class: ClassNode,
      lifeline: LifelineNode,
      sequenceMessage: SequenceMessageNode,
      actor: ActorNode,
      useCase: UseCaseNode,
      activityNode: ActivityNode,
      stateNode: StateNode,
      component: ComponentNode,
      deployment: DeploymentNode,
      artifact: ArtifactNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      mermaid: MermaidStyleEdge,
      mermaidBezier: MermaidBezierEdge,
    }),
    []
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      pushPast();
      const newEdge = {
        ...params,
        type: "mermaid",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, pushPast]
  );

  const onNodeDragStart = useCallback(() => {
    pushPast();
  }, [pushPast]);

  /* ---------- Styles & Layout Handlers ---------- */

  const handleLayoutDirectionChange = useCallback((dir: string) => {
    if (!diagramCode) return;
    // Replace direction in graph/flowchart definition
    // Improve regex to tolerate whitespace, newlines, and comments before the direction
    // E.g. "graph TD", "flowchart   LR", "  graph \n TD", etc.
    // Also handle possible frontmatter if present
    const regex = /((?:^|\n)\s*(?:graph|flowchart)\s+)(TD|TB|BT|RL|LR)/i;
    if (regex.test(diagramCode)) {
      const newCode = diagramCode.replace(regex, `$1${dir}`);
      setDiagramCode(newCode);
    } else {
      // If no direction found, maybe it's using "direction LR" inside (e.g. for subgraphs or new syntax)
      // But for top-level, let's try to inject if it starts with graph/flowchart without direction?
      // For now, just try to replace if it matches the pattern
    }
    setLayoutDirection(dir);
  }, [diagramCode]);

  const { nodeSpacing, rankSpacing } = useMemo(() => {
    switch (spacing) {
      case "compact": return { nodeSpacing: 10, rankSpacing: 30 };
      case "wide": return { nodeSpacing: 80, rankSpacing: 80 };
      default: return { nodeSpacing: 50, rankSpacing: 50 };
    }
  }, [spacing]);

  /* ---------- Prompt handler ---------- */
  const handlePrompt = useCallback(async (prompt: string) => {
    const trimmedPrompt = (prompt ?? "").trim();
    lastPromptRef.current = trimmedPrompt;
    setLoading(true);
    setPendingPlan(null);
    try {
      if (!trimmedPrompt) {
        toast.error("Please enter a prompt.");
        setLoading(false);
        return;
      }

      // Check for guest limit
      // Check for guest limit
      const token = getToken();
      const isDev = process.env.NODE_ENV === "development";

      if (!token && !isDev) {
        const count = parseInt(localStorage.getItem("guest_diagram_count") || "0", 10);
        if (count >= 10) { // Bumped to 10 for safety, but isDev handles local testing
          setLoading(false);
          setSignupOpen(true);
          toast.info("Sign up to create more diagrams!");
          return;
        }
        localStorage.setItem("guest_diagram_count", (count + 1).toString());
      }

      const diagramTypeToSend = toValidDiagramType(diagramType);

      // When diagram exists, use update endpoint to refine it
      if (diagramCode && diagramCode.trim()) {
        const response = await fetch(getUpdateUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            current_mermaid: diagramCode,
            model: selectedModel || null,
            code_detail_level: "small",
            diagram_type: diagramTypeToSend,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          const message =
            typeof data.detail === "string"
              ? data.detail
              : Array.isArray(data.detail) && data.detail[0]?.msg
                ? `${data.detail[0].loc?.join(".") ?? "request"}: ${data.detail[0].msg}`
                : "Diagram update failed. Please try again.";
          toast.error(message, {
            action: {
              label: "Retry",
              onClick: () => handlePrompt(lastPromptRef.current),
            },
          });
          setLoading(false);
          return;
        }
        // Apply update result (same shape as generate)
        setDiagramCode(data.mermaid ?? diagramCode);
        setDiagramVersions(data.versions ?? [{ code: data.mermaid ?? diagramCode, layout: "Default", direction: "TB", description: "Updated" }]);
        setSelectedVersionIndex(0);
        setExplanation(data.explanation ?? null);
        setModelResponse(data.model_response ?? null);
        setDiagramPlan(null);
        setContextMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", content: trimmedPrompt, timestamp: new Date() },
        ]);
        toast.success("Diagram updated");
        setLoading(false);
        return;
      }

      if (planFirstMode) {
        const response = await fetch(getPlanUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            diagram_type: diagramTypeToSend,
            model: selectedModel || null,
            code_detail_level: "small",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          const message =
            typeof data.detail === "string"
              ? data.detail
              : Array.isArray(data.detail) && data.detail[0]?.msg
                ? `${data.detail[0].loc?.join(".") ?? "request"}: ${data.detail[0].msg}`
                : "Plan generation failed.";
          toast.error(message);
          setLoading(false);
          return;
        }
        setPendingPlan({
          diagram_plan: data.diagram_plan as Record<string, unknown>,
          diagram_type: (data.diagram_type as DiagramType) || diagramType,
          prompt: trimmedPrompt,
        });
        // Add user message for context
        setContextMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: trimmedPrompt,
            timestamp: new Date(),
          },
        ]);
        toast.success("Plan ready — confirm to generate diagram");
        setLoading(false);
        return;
      }

      const response = await fetch(getGenerateUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          diagram_type: diagramTypeToSend,
          model: selectedModel || null,
          code_detail_level: "small",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail) && data.detail[0]?.msg
              ? `${data.detail[0].loc?.join(".") ?? "request"}: ${data.detail[0].msg}`
              : "Diagram generation failed. Please try again.";
        toast.error(message, {
          action: {
            label: "Retry",
            onClick: () => handlePrompt(lastPromptRef.current),
          },
        });
        return;
      }

      const mermaidCode = data.mermaid ?? "";
      const versions: DiagramVersion[] = data.versions ?? [];
      const explanationText =
        typeof data.explanation === "string" && data.explanation.trim()
          ? data.explanation.trim()
          : null;

      setExplanation(explanationText);
      setModelResponse({
        nodes: [],
        edges: [],
        explanation: explanationText ?? undefined,
      });
      setDiagramVersions(versions);
      setSelectedVersionIndex(0);
      if (data.diagram_plan && typeof data.diagram_plan === "object") {
        setDiagramPlan(data.diagram_plan as Record<string, unknown>);
      }

      if (mermaidCode) {
        setDiagramCode(mermaidCode);
        setNodes(EMPTY_NODES);
        setEdges([]);
        setPast([]);
        setFuture([]);
        setContextMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: trimmedPrompt,
            timestamp: new Date(),
          },
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: explanationText || "Diagram generated successfully",
            timestamp: new Date(),
            diagramType,
          },
        ]);
        toast.success("Diagram generated");
      } else {
        setDiagramCode(null);
        toast.warning("No diagram returned. Try a different prompt.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network error. Is the API running?";
      toast.error(message, {
        action: {
          label: "Retry",
          onClick: () => handlePrompt(lastPromptRef.current),
        },
      });
    } finally {
      setLoading(false);
    }
  }, [diagramType, diagramCode, selectedModel, planFirstMode, setNodes, setEdges]);

  const handleConfirmPlan = useCallback(async () => {
    if (!pendingPlan) return;
    setLoading(true);
    try {
      const response = await fetch(getGenerateFromPlanUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          diagram_plan: pendingPlan.diagram_plan,
          diagram_type: toValidDiagramType(pendingPlan.diagram_type),
          code_detail_level: "small",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : "Diagram generation failed.";
        toast.error(message);
        setLoading(false);
        return;
      }
      const mermaidCode = data.mermaid ?? "";
      const versions: DiagramVersion[] = data.versions ?? [];
      const explanationText =
        typeof data.explanation === "string" && data.explanation.trim()
          ? data.explanation.trim()
          : null;
      setExplanation(explanationText);
      setModelResponse({ nodes: [], edges: [], explanation: explanationText ?? undefined });
      setDiagramVersions(versions);
      setSelectedVersionIndex(0);
      if (data.diagram_plan && typeof data.diagram_plan === "object") {
        setDiagramPlan(data.diagram_plan as Record<string, unknown>);
      }
      if (mermaidCode) {
        setDiagramCode(mermaidCode);
        setNodes(EMPTY_NODES);
        setEdges([]);
        setPast([]);
        setFuture([]);
        setContextMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: explanationText || "Diagram generated",
            timestamp: new Date(),
            diagramType: pendingPlan.diagram_type,
          },
        ]);
        toast.success("Diagram generated");
      } else {
        setDiagramCode(null);
        toast.warning("No diagram returned.");
      }
      setPendingPlan(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [pendingPlan, setNodes, setEdges]);

  const handleCancelPlan = useCallback(() => {
    setPendingPlan(null);
  }, []);

  const handleGenerateFromRepo = useCallback(
    async (repoUrl: string) => {
      // Check for guest limit
      const token = getToken();
      if (!token) {
        const count = parseInt(localStorage.getItem("guest_diagram_count") || "0", 10);
        if (count >= 2) {
          setSignupOpen(true);
          toast.info("Sign up to create more diagrams!");
          return;
        }
        localStorage.setItem("guest_diagram_count", (count + 1).toString());
      }
      setLoading(true);
      try {
        const response = await fetch(getGenerateFromRepoUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            repo_url: (repoUrl || "").trim(),
            diagram_type: toValidDiagramType(diagramType),
            model: selectedModel || null,
            code_detail_level: "small",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const message =
            typeof data.detail === "string"
              ? data.detail
              : "Repo analysis or diagram generation failed.";
          toast.error(message);
          return;
        }

        const mermaidCode = data.mermaid ?? "";
        const versions: DiagramVersion[] = data.versions ?? [];
        const explanationText =
          typeof data.explanation === "string" && data.explanation.trim()
            ? data.explanation.trim()
            : null;

        setExplanation(explanationText);
        const repoUrlReturned = typeof data.repo_url === "string" ? data.repo_url : undefined;
        const repoExplanationReturned = typeof data.repo_explanation === "string" ? data.repo_explanation : undefined;
        const diagramPlanSummary = typeof data.diagram_plan_summary === "string" ? data.diagram_plan_summary : undefined;
        setModelResponse({
          nodes: [],
          edges: [],
          explanation: explanationText ?? undefined,
          repo_url: repoUrlReturned,
          repo_explanation: repoExplanationReturned,
          diagram_plan_summary: diagramPlanSummary,
        });
        setDiagramVersions(versions);
        setSelectedVersionIndex(0);
        if (data.diagram_plan && typeof data.diagram_plan === "object") {
          setDiagramPlan(data.diagram_plan as Record<string, unknown>);
        }

        if (mermaidCode) {
          setDiagramCode(mermaidCode);
          setNodes(EMPTY_NODES);
          setEdges([]);
          setPast([]);
          setFuture([]);
          const now = Date.now();
          const assistantContent = [
            repoExplanationReturned && `REPOSITORY ANALYSIS\n\n${repoExplanationReturned}`,
            diagramPlanSummary && `\n\n━━━ DIAGRAM PLAN (${diagramType}) ━━━\n\n${diagramPlanSummary}`,
            "\n\nDiagram generated successfully.",
          ]
            .filter(Boolean)
            .join("");
          setContextMessages((prev) => [
            ...prev,
            {
              id: `user-${now}`,
              role: "user",
              content: `Generate diagram from repo: ${repoUrl}`,
              timestamp: new Date(),
            },
            {
              id: `assistant-${now}`,
              role: "assistant",
              content: assistantContent || explanationText || "Diagram generated from repository",
              timestamp: new Date(),
              diagramType,
            },
          ]);
          toast.success("Diagram generated from repository");
        } else {
          setDiagramCode(null);
          toast.warning("No diagram returned.");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Network error. Is the API running?";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [diagramType, selectedModel, setNodes, setEdges]
  );

  const hasDiagram = diagramCode != null || nodes.length > 0;
  const showWelcome = !hasDiagram;

  const selectedNode = useMemo(
    () => (nodes.filter((n) => n.selected).length === 1 ? nodes.find((n) => n.selected) ?? null : null),
    [nodes]
  );

  const openEditForNode = useCallback(
    (node: Node) => {
      if (diagramCode) return;
      setEditingNode({
        id: node.id,
        type: node.type ?? "default",
        data: { ...(node.data as Record<string, unknown>) },
      });
    },
    [diagramCode]
  );

  const handlePrepareExport = useCallback((exportFn: () => Promise<void>) => {
    setIsExporting(true);
    setTimeout(async () => {
      try {
        await exportFn();
      } finally {
        setIsExporting(false);
      }
    }, 80);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => openEditForNode(node),
    [openEditForNode]
  );

  const handleEditSave = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      pushPast();
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
      setEditingNode(null);
      toast.success("Node updated");
    },
    [setNodes, pushPast]
  );

  const handleEditCancel = useCallback(() => {
    setEditingNode(null);
  }, []);

  const maybeAdjustCodeLevelFromPrompt = useCallback((prompt: string): { prompt: string; regenerateOnly?: boolean } => {
    return { prompt };
  }, []);

  /* Regenerate diagram from plan with current code level (for "show full code" etc.) */
  const handleRegenerateFromPlan = useCallback(async () => {
    if (!diagramPlan || !diagramCode) return;
    setLoading(true);
    try {
      const response = await fetch(getGenerateFromPlanUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          diagram_plan: diagramPlan,
          diagram_type: toValidDiagramType(diagramType),
          code_detail_level: "small",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(typeof data.detail === "string" ? data.detail : "Failed to refresh");
        return;
      }
      if (data.mermaid) {
        setDiagramCode(data.mermaid);
        setDiagramVersions(data.versions ?? [{ code: data.mermaid, layout: "Default", direction: "TB", description: "Refreshed" }]);
        setSelectedVersionIndex(0);
        toast.success("Diagram refreshed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [diagramPlan, diagramCode, diagramType]);

  /* SideKick chat message handler - combines context + generates */
  const handleSideKickMessage = useCallback(
    (message: string) => {
      const { prompt: adjustedPrompt, regenerateOnly } = maybeAdjustCodeLevelFromPrompt(message);
      if (regenerateOnly && diagramPlan && diagramCode) {
        handleRegenerateFromPlan();
        return;
      }
      const contextStr = contextMessages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const refinedPrompt = contextStr
        ? `Previous context:\n${contextStr}\n\nUser's refinement: ${adjustedPrompt}`
        : adjustedPrompt;
      if (refinedPrompt.trim()) handlePrompt(refinedPrompt);
    },
    [contextMessages, handlePrompt, maybeAdjustCodeLevelFromPrompt, handleRegenerateFromPlan, diagramPlan, diagramCode]
  );

  /* SideKick primary submit - direct prompt (no context prefix for first message) */
  const handleSideKickSubmit = useCallback(
    (prompt: string) => {
      const { prompt: adjustedPrompt, regenerateOnly } = maybeAdjustCodeLevelFromPrompt(prompt);
      if (regenerateOnly && diagramPlan && diagramCode) {
        handleRegenerateFromPlan();
        return;
      }
      if (contextMessages.length === 0) {
        if (adjustedPrompt.trim()) handlePrompt(adjustedPrompt);
      } else {
        const contextStr = contextMessages.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n");
        const refinedPrompt = contextStr ? `Previous context:\n${contextStr}\n\nUser's refinement: ${adjustedPrompt}` : adjustedPrompt;
        if (refinedPrompt.trim()) handlePrompt(refinedPrompt);
      }
    },
    [contextMessages, handlePrompt, maybeAdjustCodeLevelFromPrompt, handleRegenerateFromPlan, diagramPlan, diagramCode]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      const idx = contextMessages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const updated = [
        ...contextMessages.slice(0, idx),
        { ...contextMessages[idx], content: newContent, timestamp: new Date() },
      ];
      setContextMessages(updated);
      const contextStr = updated
        .slice(0, -1)
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const refinedPrompt = contextStr
        ? `Previous context:\n${contextStr}\n\nUser's refinement: ${newContent}`
        : newContent;
      handlePrompt(refinedPrompt);
    },
    [contextMessages, handlePrompt]
  );

  const handleClearContextHistory = useCallback(() => {
    setContextMessages([]);
    toast.success("Context history cleared");
  }, []);



  const handleSelectVersion = useCallback((index: number) => {
    if (diagramVersions[index]) {
      setSelectedVersionIndex(index);
      setDiagramCode(diagramVersions[index].code);
      toast.success(`Switched to ${diagramVersions[index].layout} layout`);
    }
  }, [diagramVersions]);

  /* Handler for clicking entity in Mermaid diagram */
  const handleEntityClick = useCallback((nodeId: string, label?: string | undefined, event?: MouseEvent) => {
    if (!event) return; // Guard clause for optional event

    // Get position for popup
    const position = { x: event.clientX, y: event.clientY };

    setEditingEntity({
      id: nodeId,
      label: label || nodeId,
      position,
      styles: {
        fontFamily: diagramFont,
        fill: customColors.nodeColor,
        stroke: customColors.edgeColor,
      },
    });
  }, [diagramFont, customColors]);

  /* Handler to save entity edits - update Mermaid code */
  const handleEntitySave = useCallback((entityId: string, updates: {
    label?: string;
    fontFamily?: string;
    fontSize?: string;
    fill?: string;
    stroke?: string;
  }) => {
    if (!diagramCode) return;

    let updatedCode = diagramCode;

    if (updates.label != null && updates.label.trim() !== "") {
      const result = updateNodeLabel(diagramCode, entityId, updates.label.trim());
      if (!result.success) {
        toast.error(result.error ?? "Could not update node");
        return;
      }
      updatedCode = result.code;
    }

    // Add style directive for colors and fonts (classDef + class)
    const hasStyles = updates.fill || updates.stroke || updates.fontFamily || updates.fontSize;
    if (hasStyles) {
      const className = `style_${entityId}`;
      let styleDef = `    classDef ${className}`;
      const styleProps: string[] = [];

      if (updates.fill) styleProps.push(`fill:${updates.fill}`);
      if (updates.stroke) styleProps.push(`stroke:${updates.stroke}`);
      if (updates.fontFamily) {
        const fontName = updates.fontFamily.split(',')[0].trim();
        styleProps.push(`font-family:${fontName}`);
      }
      if (updates.fontSize) styleProps.push(`font-size:${updates.fontSize}`);

      if (styleProps.length > 0) {
        styleDef += ` ${styleProps.join(',')};`;

        // Check if classDef already exists for this entity
        const classDefPattern = new RegExp(`classDef ${className}[^\n]*`, 'g');
        if (classDefPattern.test(updatedCode)) {
          // Replace existing
          updatedCode = updatedCode.replace(classDefPattern, styleDef);
        } else {
          // Add at the end
          updatedCode += `\n${styleDef}`;
        }

        // Apply class to node
        const classApplyPattern = new RegExp(`class ${entityId} ${className}[^\n]*`, 'g');
        if (!classApplyPattern.test(updatedCode)) {
          updatedCode += `\n    class ${entityId} ${className}`;
        }
      }
    }

    setDiagramCode(updatedCode);
    setEditingEntity(null);
    toast.success("Node updated");
  }, [diagramCode]);

  const handleEntityCancel = useCallback(() => {
    setEditingEntity(null);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-row overflow-hidden">
      {/* ==================== Main content area ==================== */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-canvas transition-colors duration-300">
        {/* ---- Top toolbar ---- */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3 border-b border-panel bg-panel px-2 sm:px-4 py-2 transition-colors duration-300 overflow-x-auto">
          {/* New diagram */}
          {hasDiagram && (
            <button
              type="button"
              onClick={handleNewDiagram}
              className="flex h-9 sm:h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 sm:px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition shrink-0"
              title="New diagram (Ctrl+N)"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}

          {/* Diagram type */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="text-xs font-medium text-muted hidden md:inline">Diagram:</span>
            <DiagramTypeSelector
              value={diagramType}
              onChange={setDiagramType}
              disabled={loading}
            />
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <ModelSelector
              value={selectedModel}
              options={modelOptions}
              onChange={setSelectedModel}
              disabled={loading}
            />
          </div>

          {/* Plan first toggle */}
          <label className="hidden lg:flex cursor-pointer items-center gap-1.5 text-xs text-muted shrink-0">
            <input
              type="checkbox"
              checked={planFirstMode}
              onChange={(e) => setPlanFirstMode(e.target.checked)}
              disabled={loading}
              className="rounded border-[var(--border)]"
            />
            <span>Plan first</span>
          </label>

          {/* Spacer */}
          <div className="flex-1 min-w-2" />

          {/* Undo/Redo */}
          {!showWelcome && !diagramCode && (
            <>
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0 || loading}
                className="hidden sm:flex h-9 sm:h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:pointer-events-none shrink-0"
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0 || loading}
                className="hidden sm:flex h-9 sm:h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:pointer-events-none shrink-0"
                title="Redo (Ctrl+Shift+Z)"
              >
                Redo
              </button>
            </>
          )}

          {/* Save / My Diagrams */}
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDiagramsPanelOpen(true)}
              className="flex h-9 sm:h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 sm:px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition shrink-0"
              title="My Diagrams"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diagrams</span>
            </button>
            {hasDiagram && (
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                className="flex h-9 sm:h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 sm:px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition shrink-0"
                title="Save diagram (Ctrl+S)"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{savedDiagramId ? "Update" : "Save"}</span>
              </button>
            )}
            {savedDiagramTitle && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-[var(--muted)] max-w-[120px] truncate" title={savedDiagramTitle}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {savedDiagramTitle}
              </span>
            )}
          </div>

          {/* Download */}
          {!showWelcome && (
            <div className="shrink-0">
              <DiagramDownloadMenu
                containerRef={flowContainerRef}
                diagramType={diagramType}
                nodes={nodes}
                edges={edges}
                diagramCode={diagramCode}
                onPrepareExport={handlePrepareExport}
                disabled={loading}
                open={downloadMenuOpen}
                onOpenChange={setDownloadMenuOpen}
                userPlan={user?.plan}
              />
            </div>
          )}

          <div className="shrink-0">
            <ThemeToggle />
          </div>

          {/* Architect panel toggle */}
          <div className="shrink-0">
            <SideKickToggle
              onClick={() => setShowSideKick((p) => !p)}
              isOpen={showSideKick}
            />
          </div>
        </div>

        {/* ---- Canvas / Diagram area ---- */}
        <div
          id="canvas-area"
          ref={flowContainerRef}
          role="main"
          aria-label={diagramCode ? "Rendered diagram" : "Diagram canvas"}
          data-exporting={isExporting ? "true" : undefined}
          className="relative flex-1 min-h-0 min-w-0 overflow-auto bg-canvas transition-colors duration-300 data-[exporting=true]:[&_[data-diagram-download-hide]]:invisible"
        >
          {diagramCode ? (
            showCode ? (
              /* Show raw Mermaid code */
              <div className={cn("flex h-full w-full flex-col items-center justify-center p-6 bg-canvas transition-all duration-300", diagramControlsOpen ? "pl-[280px]" : "p-6")}>
                <div className="w-full max-w-4xl rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)] px-4 py-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">Mermaid Code</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(diagramCode);
                        toast.success("Code copied to clipboard!");
                      }}
                      className="rounded px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="overflow-auto p-4 text-sm text-[var(--foreground)] bg-[var(--background)] max-h-[calc(100vh-200px)]">
                    <code>{diagramCode}</code>
                  </pre>
                </div>
              </div>
            ) : (
              /* Show rendered diagram */
              <MermaidDiagram
                code={diagramCode}
                className={cn(
                  "h-full w-full transition-all duration-300",
                  diagramControlsOpen && "pl-64",
                  canvasLayout === "adaptive" && "flex items-center justify-center",
                  canvasLayout === "horizontal" && "min-w-full"
                )}
                is3D={is3D}
                look={look}
                diagramTheme={diagramTheme}
                fontFamily={diagramFont}
                customColors={customColors}
                edgeCurve={edgeCurve}
                nodeSpacing={nodeSpacing}
                rankSpacing={rankSpacing}
                backgroundPattern={backgroundPattern}
                nodeCodeMap={buildNodeCodeMap(diagramPlan, diagramType)}
                onNodeClick={handleEntityClick}
              />
            )
          ) : showWelcome ? (
            /* ---- Empty canvas placeholder ---- */
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                <Sparkles className="h-8 w-8 text-[var(--primary)] opacity-60" />
              </div>
              <p className="text-lg font-medium text-[var(--foreground)] opacity-80">
                Your diagram will appear here
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Use the Architect panel to describe your system
              </p>
              {!showSideKick && (
                <button
                  type="button"
                  onClick={() => setShowSideKick(true)}
                  className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Open Architect
                </button>
              )}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStart={onNodeDragStart}
              onNodeDoubleClick={handleNodeDoubleClick}
              defaultEdgeOptions={{
                type: "mermaid",
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed },
              }}
              fitView
              fitViewOptions={{ padding: 0.25, minZoom: 0.3, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={backgroundPattern === "lines" ? BackgroundVariant.Lines : backgroundPattern === "cross" ? BackgroundVariant.Cross : BackgroundVariant.Dots}
                gap={spacing === "compact" ? 15 : spacing === "wide" ? 30 : 20}
                size={1}
                color={theme === "dark"
                  ? (backgroundPattern === "none" ? "transparent" : "rgba(71, 85, 105, 0.35)")
                  : (backgroundPattern === "none" ? "transparent" : "rgba(71, 85, 105, 0.2)")
                }
              />
              <CanvasKeyboardShortcuts
                onUndo={undo}
                onRedo={redo}
                canUndo={past.length > 0}
                canRedo={future.length > 0}
                onNewDiagram={handleNewDiagram}
                onOpenExport={() => setDownloadMenuOpen(true)}
                onToggleSidebar={() => setShowSideKick((p) => !p)}
                onShowHelp={() => setShowHelp(true)}
                onCloseOverlays={() => {
                  setEditingNode(null);
                  setShowHelp(false);
                }}
                onSave={() => {
                  if (hasDiagram) setSaveModalOpen(true);
                }}
              />
              {selectedNode && !editingNode && (
                <Panel position="top-center" className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForNode(selectedNode)}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] shadow hover:bg-[var(--secondary)]"
                  >
                    Edit text
                  </button>
                </Panel>
              )}
            </ReactFlow>
          )}


          {diagramCode && (
            <>
              {/* Diagram Controls Panel */}
              <DiagramControlsPanel
                isOpen={diagramControlsOpen}
                onToggle={() => setDiagramControlsOpen(p => !p)}
                look={look}
                setLook={setLook}
                is3D={is3D}
                setIs3D={setIs3D}
                diagramTheme={diagramTheme}
                setDiagramTheme={setDiagramTheme}
                diagramFont={diagramFont}
                setDiagramFont={setDiagramFont}
                showCode={showCode}
                setShowCode={setShowCode}
                diagramVersions={diagramVersions}
                selectedVersionIndex={selectedVersionIndex}
                onVersionChange={(idx, code) => {
                  setSelectedVersionIndex(idx);
                  setDiagramCode(code);
                }}
                customColors={customColors}
                setCustomColors={setCustomColors}
                // Advanced Styling
                backgroundPattern={backgroundPattern}
                setBackgroundPattern={setBackgroundPattern}
                edgeCurve={edgeCurve}
                setEdgeCurve={setEdgeCurve}
                spacing={spacing}
                setSpacing={setSpacing}
                layoutDirection={layoutDirection}
                setLayoutDirection={handleLayoutDirectionChange}
                canvasLayout={canvasLayout}
                setCanvasLayout={setCanvasLayout}
                diagramType={diagramType}
                onEditCode={onEditCode ? () => onEditCode(diagramCode!) : undefined}
                diagramPlan={diagramPlan}
              />

              <DiagramZoomControls containerRef={flowContainerRef} visible={!!diagramCode && !showCode} />
            </>
          )}


          {explanation && !showWelcome && (
            <div data-diagram-download-hide className={cn("absolute right-3 top-16 z-10 max-w-2xl rounded border border-[var(--border)] bg-[var(--card)]/95 px-3 py-2 transition-all duration-300", diagramControlsOpen ? "left-[270px]" : "left-3")}>
              <p className="text-xs font-medium text-[var(--primary)]">How it works</p>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">{explanation}</p>
            </div>
          )}

          {!showWelcome && !diagramCode && !editingNode && (
            <p data-diagram-download-hide className={cn("absolute bottom-4 z-10 text-xs text-slate-500 transition-all duration-300", diagramControlsOpen ? "left-[270px]" : "left-4")}>
              Select a node, then click &quot;Edit text&quot; above — or double-click
            </p>
          )}

          {editingNode && !diagramCode && (
            <EditNodePanel
              node={editingNode}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          )}

          {loading && <GeneratingOverlay />}
        </div>
      </div>

      {/* ==================== SideKick (right panel) ==================== */}
      <SideKick
        messages={contextMessages}
        onSendMessage={handleSideKickMessage}
        onSubmit={handleSideKickSubmit}
        onEditMessage={handleEditMessage}
        onClearHistory={handleClearContextHistory}
        isLoading={loading}
        isOpen={showSideKick}
        onClose={() => setShowSideKick(false)}
        pendingPlan={pendingPlan}
        onConfirmPlan={handleConfirmPlan}
        onCancelPlan={handleCancelPlan}
        planSummary={pendingPlan ? summarizePlan(pendingPlan.diagram_plan, pendingPlan.diagram_type) : undefined}
        onSelectRepo={handleGenerateFromRepo}
        newDiagramCount={newDiagramCount}
        diagramPlan={diagramPlan}
        diagramType={diagramType}
        hasDiagram={!!diagramCode}
      />

      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <SaveDiagramModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSaved={(id, title) => {
          if (id) setSavedDiagramId(id);
          if (title) setSavedDiagramTitle(title);
          toast.success("Diagram saved");
          setSaveModalOpen(false);
        }}
        diagramType={diagramType}
        diagramCode={diagramCode}
        nodes={nodes}
        edges={edges}
        diagramPlan={diagramPlan}
        diagramId={savedDiagramId}
        existingTitle={savedDiagramTitle}
      />

      <DiagramsListPanel
        isOpen={diagramsPanelOpen}
        onClose={() => setDiagramsPanelOpen(false)}
        onLoad={handleLoadDiagram}
      />

      {/* Entity edit popup for Mermaid diagram entities */}
      {editingEntity && (
        <EntityEditPopup
          position={editingEntity.position}
          entityId={editingEntity.id}
          label={editingEntity.label}
          styles={editingEntity.styles}
          onSave={handleEntitySave}
          onCancel={handleEntityCancel}
        />
      )}

      {/* Sign up modal for guest limit */}
      <SignupModal
        isOpen={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSuccess={() => {
          setSignupOpen(false);
          window.dispatchEvent(new Event("auth-change"));
        }}
        onSwitchToLogin={() => {
          setSignupOpen(false);
          // Optional: Trigger login modal if needed, but for now just close signup
        }}
      />

    </div >
  );
}

// Wrap with ReactFlowProvider to enable useReactFlow hook
// Wrap with ReactFlowProvider to enable useReactFlow hook
export default function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
