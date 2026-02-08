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
import { DiagramDownloadMenu } from "./DiagramDownloadMenu";
import { EditNodePanel, type EditingNode } from "./EditNodePanel";
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
import { MermaidDiagram } from "./MermaidDiagram";
import { SideKick, SideKickToggle, type ContextMessage } from "./SideKick";
import { cn } from "@/lib/utils";
import { VersionSwitcher, type DiagramVersion } from "./VersionSwitcher";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { Sparkles, FilePlus2 } from "lucide-react";

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
  if (diagramType === "mindtree") {
    const nodes = plan.nodes as Array<{ label?: string }> | undefined;
    if (Array.isArray(nodes) && nodes.length) {
      return nodes.map((n) => n.label || "?").join(" → ");
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
  return "Plan ready";
}

function CanvasInner() {
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
  const [showHelp, setShowHelp] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [newDiagramCount, setNewDiagramCount] = useState(0);
  // Undo/redo history (only for React Flow canvas; not for Mermaid view)
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const skipNextPushRef = useRef(false);
  const lastPromptRef = useRef<string>("");
  const flowContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(getModelsUrl())
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models) && d.models.length > 0) {
          setModelOptions(d.models);
          if (d.default) setSelectedModel(d.default);
        }
      })
      .catch(() => {});
  }, []);

  // Restore persisted state from localStorage
  useLayoutEffect(() => {
    try {
      const sidebar = localStorage.getItem("showSideKick");
      const raw = localStorage.getItem("contextMessages");
      if (sidebar !== null) setShowSideKick(sidebar === "true");
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
    setExplanation(null);
    setModelResponse(null);
    setNewDiagramCount((c) => c + 1); // Clears GitHub repos panel cache
    toast.success("New diagram");
  }, [setNodes, setEdges]);

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
      const diagramTypeToSend = toValidDiagramType(diagramType);

      if (planFirstMode) {
        const response = await fetch(getPlanUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            diagram_type: diagramTypeToSend,
            model: selectedModel || null,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          diagram_type: diagramTypeToSend,
          model: selectedModel || null,
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
  }, [diagramType, selectedModel, planFirstMode, setNodes, setEdges]);

  const handleConfirmPlan = useCallback(async () => {
    if (!pendingPlan) return;
    setLoading(true);
    try {
      const response = await fetch(getGenerateFromPlanUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagram_plan: pendingPlan.diagram_plan,
          diagram_type: toValidDiagramType(pendingPlan.diagram_type),
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
      setLoading(true);
      try {
        const response = await fetch(getGenerateFromRepoUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_url: (repoUrl || "").trim(),
            diagram_type: toValidDiagramType(diagramType),
            model: selectedModel || null,
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

  /* SideKick chat message handler - combines context + generates */
  const handleSideKickMessage = useCallback(
    (message: string) => {
      const contextStr = contextMessages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const refinedPrompt = contextStr
        ? `Previous context:\n${contextStr}\n\nUser's refinement: ${message}`
        : message;
      handlePrompt(refinedPrompt);
    },
    [contextMessages, handlePrompt]
  );

  /* SideKick primary submit - direct prompt (no context prefix for first message) */
  const handleSideKickSubmit = useCallback(
    (prompt: string) => {
      if (contextMessages.length === 0) {
        // First message: send directly
        handlePrompt(prompt);
      } else {
        // Subsequent messages: include context
        handleSideKickMessage(prompt);
      }
    },
    [contextMessages, handlePrompt, handleSideKickMessage]
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

  return (
    <div className="relative flex h-full w-full flex-row overflow-hidden">
      {/* ==================== Main content area ==================== */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-canvas transition-colors duration-300">
        {/* ---- Top toolbar ---- */}
        <div className="flex shrink-0 items-center gap-3 border-b border-panel bg-panel px-4 py-2 transition-colors duration-300">
          {/* New diagram */}
          {hasDiagram && (
            <button
              type="button"
              onClick={handleNewDiagram}
              className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition"
              title="New diagram (Ctrl+N)"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              New
            </button>
          )}

          {/* Diagram type */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted">Diagram:</span>
            <DiagramTypeSelector
              value={diagramType}
              onChange={setDiagramType}
              disabled={loading}
            />
          </div>

          {/* Plan first toggle */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={planFirstMode}
              onChange={(e) => setPlanFirstMode(e.target.checked)}
              disabled={loading}
              className="rounded border-[var(--border)]"
            />
            <span>Plan first</span>
          </label>

          {/* Version Switcher - inline in toolbar */}
          {!showWelcome && diagramVersions.length > 1 && (
            <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
              {diagramVersions.map((version, index) => {
                const isSelected = index === selectedVersionIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectVersion(index)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition",
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                    )}
                    title={version.description}
                  >
                    {version.layout}
                  </button>
                );
              })}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Undo/Redo */}
          {!showWelcome && !diagramCode && (
            <>
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0 || loading}
                className="flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:pointer-events-none"
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0 || loading}
                className="flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:pointer-events-none"
                title="Redo (Ctrl+Shift+Z)"
              >
                Redo
              </button>
            </>
          )}

          {/* Download */}
          {!showWelcome && (
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
            />
          )}

          <ThemeToggle />

          {/* Architect panel toggle */}
          <SideKickToggle
            onClick={() => setShowSideKick((p) => !p)}
            isOpen={showSideKick}
          />
        </div>

        {/* ---- Canvas / Diagram area ---- */}
        <div
          ref={flowContainerRef}
          role="main"
          aria-label={diagramCode ? "Rendered diagram" : "Diagram canvas"}
          data-exporting={isExporting ? "true" : undefined}
          className="relative flex-1 min-h-0 min-w-0 overflow-auto bg-canvas transition-colors duration-300 data-[exporting=true]:[&_[data-diagram-download-hide]]:invisible"
        >
          {diagramCode ? (
            <MermaidDiagram code={diagramCode} className="h-full min-h-0 w-full min-w-0" />
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
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color={theme === "dark" ? "rgba(71, 85, 105, 0.35)" : "rgba(71, 85, 105, 0.2)"}
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

          {/* Zoom controls for Mermaid diagrams */}
          {diagramCode && (
            <div data-diagram-download-hide className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  const svg = flowContainerRef.current?.querySelector("svg");
                  if (!svg) return;
                  const cur = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || "1");
                  const next = Math.min(cur + 0.15, 3);
                  svg.style.transform = `scale(${next})`;
                  svg.style.transformOrigin = "center center";
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const svg = flowContainerRef.current?.querySelector("svg");
                  if (!svg) return;
                  const cur = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || "1");
                  const next = Math.max(cur - 0.15, 0.3);
                  svg.style.transform = `scale(${next})`;
                  svg.style.transformOrigin = "center center";
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const svg = flowContainerRef.current?.querySelector("svg");
                  if (!svg) return;
                  svg.style.transform = "scale(1)";
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                1:1
              </button>
            </div>
          )}

          {explanation && !showWelcome && (
            <div data-diagram-download-hide className="absolute left-3 right-3 top-16 z-10 max-w-2xl rounded border border-[var(--border)] bg-[var(--card)]/95 px-3 py-2">
              <p className="text-xs font-medium text-[var(--primary)]">How it works</p>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">{explanation}</p>
            </div>
          )}

          {!showWelcome && !diagramCode && !editingNode && (
            <p data-diagram-download-hide className="absolute bottom-4 left-4 z-10 text-xs text-slate-500">
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
      />

      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

// Wrap with ReactFlowProvider to enable useReactFlow hook
export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
