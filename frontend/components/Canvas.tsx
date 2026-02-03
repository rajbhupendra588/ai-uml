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
import { PromptBar } from "./PromptBar";
import HardwareNode from "./HardwareNode";
import { WelcomeState } from "./WelcomeState";
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
import { ModelSelector } from "./ModelSelector";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./ThemeProvider";
import { MermaidDiagram } from "./MermaidDiagram";
import { ContextPanel, ContextToggle, type ContextMessage } from "./ContextPanel";
import { RightSidebar, RightSidebarToggle } from "./RightSidebar";
import { VersionSwitcher, type DiagramVersion } from "./VersionSwitcher";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";

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
  onToggleContext,
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
  onToggleContext: () => void;
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
      if (mod && e.key === "1") {
        e.preventDefault();
        onToggleContext();
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
    onToggleContext,
    onToggleSidebar,
    onShowHelp,
    onCloseOverlays,
  ]);
  return null;
}

/** Summarize diagram plan for preview (no new deps). */
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
  // Context panel and right sidebar - init same on server/client to avoid hydration mismatch
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [contextMessages, setContextMessages] = useState<ContextMessage[]>([]);
  const [diagramVersions, setDiagramVersions] = useState<DiagramVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
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

  // Restore persisted state from localStorage - use useLayoutEffect to apply before paint
  useLayoutEffect(() => {
    try {
      const panel = localStorage.getItem("showContextPanel");
      const sidebar = localStorage.getItem("showRightSidebar");
      const raw = localStorage.getItem("contextMessages");
      const updates: { panel?: boolean; sidebar?: boolean; messages?: ContextMessage[] } = {};
      if (panel !== null) updates.panel = panel === "true";
      if (sidebar !== null) updates.sidebar = sidebar === "true";
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; role: string; content: string; timestamp: string; diagramType?: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          updates.messages = parsed.map((m) => ({
            ...m,
            role: m.role as "user" | "assistant",
            timestamp: new Date(m.timestamp),
          }));
        }
      }
      if (Object.keys(updates).length > 0) {
        if (updates.panel !== undefined) setShowContextPanel(updates.panel);
        if (updates.sidebar !== undefined) setShowRightSidebar(updates.sidebar);
        if (updates.messages !== undefined) setContextMessages(updates.messages);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist context panel and right sidebar visibility
  useEffect(() => {
    try {
      localStorage.setItem("showContextPanel", String(showContextPanel));
    } catch {
      // ignore
    }
  }, [showContextPanel]);
  useEffect(() => {
    try {
      localStorage.setItem("showRightSidebar", String(showRightSidebar));
    } catch {
      // ignore
    }
  }, [showRightSidebar]);

  // Persist context messages (cap at 50 to avoid huge storage)
  useEffect(() => {
    if (contextMessages.length === 0) return;
    try {
      const toStore = contextMessages.slice(-50).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem("contextMessages", JSON.stringify(toStore));
    } catch {
      // ignore
    }
  }, [contextMessages]);

  const pushPast = useCallback(() => {
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    setPast((prev) => {
      const next = [...prev, cloneSnapshot(nodes, edges)].slice(-MAX_UNDO_HISTORY);
      return next;
    });
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

  // Convert edges to Mermaid-style edges
  const convertToMermaidEdges = useCallback((edges: Edge[]): Edge[] => {
    return edges.map((edge) => ({
      ...edge,
      type: "mermaid",
      animated: edge.animated ?? true,
      markerEnd: edge.markerEnd ?? { type: MarkerType.ArrowClosed },
      data: {
        ...edge.data,
        label: edge.label || edge.data?.label,
        animated: edge.animated ?? true,
      },
    }));
  }, []);

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
      
      // Store versions and reset selected index
      setDiagramVersions(versions);
      setSelectedVersionIndex(0);

      if (mermaidCode) {
        setDiagramCode(mermaidCode);
        setNodes(EMPTY_NODES);
        setEdges([]);
        setPast([]);
        setFuture([]);
        // Add to context history
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
            : Array.isArray(data.detail) && data.detail[0]?.msg
              ? `${data.detail[0].loc?.join(".") ?? "request"}: ${data.detail[0].msg}`
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
            content: pendingPlan.prompt,
            timestamp: new Date(),
          },
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
      const message =
        error instanceof Error ? error.message : "Network error.";
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
              : Array.isArray(data.detail) && data.detail[0]?.msg
                ? `${data.detail[0].loc?.join(".") ?? "request"}: ${data.detail[0].msg}`
                : "Repo analysis or diagram generation failed. Please try again.";
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
        setModelResponse({
          nodes: [],
          edges: [],
          explanation: explanationText ?? undefined,
          repo_url: repoUrlReturned,
          repo_explanation: repoExplanationReturned,
        });
        
        // Store versions and reset selected index
        setDiagramVersions(versions);
        setSelectedVersionIndex(0);

        if (mermaidCode) {
          setDiagramCode(mermaidCode);
          setNodes(EMPTY_NODES);
          setEdges([]);
          setPast([]);
          setFuture([]);
          // Add to context history
          setContextMessages((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: `Generate diagram from repo: ${repoUrl}`,
              timestamp: new Date(),
            },
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: explanationText || "Diagram generated from repository",
              timestamp: new Date(),
              diagramType,
            },
          ]);
          toast.success("Diagram generated from repository");
        } else {
          setDiagramCode(null);
          toast.warning("No diagram returned. Try a different repo or diagram type.");
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
    // Wait for React to commit and hide Download/UI so they don't appear in the export
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

  const handleContextMessage = useCallback(
    (message: string) => {
      // Combine with previous context to refine the diagram
      const contextStr = contextMessages
        .slice(-4) // Last 4 messages for context
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      
      const refinedPrompt = contextStr
        ? `Previous context:\n${contextStr}\n\nUser's refinement: ${message}`
        : message;
      
      handlePrompt(refinedPrompt);
    },
    [contextMessages, handlePrompt]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      const idx = contextMessages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      // Replace the message and remove everything after it (assistant response + subsequent)
      const updated = [
        ...contextMessages.slice(0, idx),
        { ...contextMessages[idx], content: newContent, timestamp: new Date() },
      ];
      setContextMessages(updated);
      // Regenerate with the edited prompt (use context from messages before this one)
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

  // Handle version selection
  const handleSelectVersion = useCallback((index: number) => {
    if (diagramVersions[index]) {
      setSelectedVersionIndex(index);
      setDiagramCode(diagramVersions[index].code);
      toast.success(`Switched to ${diagramVersions[index].layout} layout`);
    }
  }, [diagramVersions]);

  const handleSelectRepo = useCallback(
    (repoUrl: string) => {
      handleGenerateFromRepo(repoUrl);
    },
    [handleGenerateFromRepo]
  );

  return (
    <div className="relative flex h-full w-full flex-row overflow-hidden">
      {/* Left sidebar - Context Panel */}
      <ContextPanel
        messages={contextMessages}
        onSendMessage={handleContextMessage}
        onEditMessage={handleEditMessage}
        onClearHistory={handleClearContextHistory}
        isLoading={loading}
        isOpen={showContextPanel}
        onClose={() => setShowContextPanel(false)}
      />

      {/* Main content area */}
      <div 
        className="grid h-full min-h-0 min-w-0 flex-1 bg-canvas transition-colors duration-300" 
        style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}
      >
        {/* Main diagram area - constrained to viewport, diagram fits or scrolls inside */}
        <div
          ref={flowContainerRef}
          role="main"
          aria-label={diagramCode ? "Rendered diagram" : "Diagram canvas"}
          data-exporting={isExporting ? "true" : undefined}
          className="relative min-h-0 min-w-0 overflow-auto bg-canvas transition-colors duration-300 data-[exporting=true]:[&_[data-diagram-download-hide]]:invisible"
        >
          {diagramCode ? (
            <MermaidDiagram code={diagramCode} className="h-full min-h-0 w-full min-w-0" />
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
                onToggleContext={() => setShowContextPanel((p) => !p)}
                onToggleSidebar={() => setShowRightSidebar((p) => !p)}
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
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] shadow hover:bg-[var(--secondary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    aria-label="Edit selected node text"
                  >
                    Edit text
                  </button>
                </Panel>
              )}
            </ReactFlow>
          )}
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

          {/* Version Switcher - only show when multiple versions available */}
          {!showWelcome && diagramVersions.length > 1 && (
            <div data-diagram-download-hide className="absolute left-3 top-3 z-20">
              <VersionSwitcher
                versions={diagramVersions}
                selectedIndex={selectedVersionIndex}
                onSelectVersion={handleSelectVersion}
              />
            </div>
          )}

          {explanation && !showWelcome && (
            <div data-diagram-download-hide className="absolute left-3 right-3 top-16 z-10 max-w-2xl rounded border border-[var(--border)] bg-[var(--card)]/95 px-3 py-2">
              <p className="text-xs font-medium text-[var(--primary)]">How it works</p>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">{explanation}</p>
            </div>
          )}

          {!showWelcome && !diagramCode && !editingNode && (
            <p
              data-diagram-download-hide
              className="absolute bottom-4 left-4 z-10 text-xs text-slate-500"
            >
              Select a node, then click &quot;Edit text&quot; above — or double-click the node
            </p>
          )}

          {editingNode && !diagramCode && (
            <EditNodePanel
              node={editingNode}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          )}

          {showWelcome && !loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="pointer-events-auto flex flex-col items-center">
                <PromptBar
                  onSubmit={handlePrompt}
                  onGenerateFromRepo={handleGenerateFromRepo}
                  isLoading={loading}
                  centered
                />
                <WelcomeState onExampleClick={handlePrompt} />
              </div>
            </div>
          )}

          {loading && <GeneratingOverlay />}

          {pendingPlan && !loading && (
            <div
              data-diagram-download-hide
              className="absolute bottom-20 left-1/2 z-20 w-full max-w-xl -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-lg"
            >
              <p className="text-xs font-medium text-[var(--muted)]">Plan preview</p>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--foreground)]">
                {summarizePlan(pendingPlan.diagram_plan, pendingPlan.diagram_type)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="bg-[var(--primary)] text-white hover:opacity-90"
                  onClick={handleConfirmPlan}
                >
                  Generate diagram
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[var(--border)]"
                  onClick={handleCancelPlan}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom control bar - always visible */}
        <div 
          className="flex shrink-0 items-center border-t border-panel bg-panel px-4 py-3 transition-colors duration-300"
          style={{ minHeight: "60px", zIndex: 50 }}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4">
            {/* Context toggle */}
            <ContextToggle
              onClick={() => setShowContextPanel((prev) => !prev)}
              isOpen={showContextPanel}
              messageCount={contextMessages.length}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={planFirstMode}
                onChange={(e) => setPlanFirstMode(e.target.checked)}
                disabled={loading}
                className="rounded border-[var(--border)]"
                aria-label="Preview plan first"
              />
              <span>Preview plan first</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted">
                Diagram:
              </span>
              <DiagramTypeSelector
                value={diagramType}
                onChange={setDiagramType}
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted">
                Model:
              </span>
              <ModelSelector
                value={selectedModel}
                options={modelOptions}
                onChange={setSelectedModel}
                disabled={loading}
              />
            </div>
            {!showWelcome && !diagramCode && (
              <div className="flex items-center gap-1" role="group" aria-label="Undo redo">
                <button
                  type="button"
                  onClick={undo}
                  disabled={past.length === 0 || loading}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-50 disabled:pointer-events-none"
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={future.length === 0 || loading}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-50 disabled:pointer-events-none"
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  Redo
                </button>
              </div>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <span className="text-lg font-medium">?</span>
            </button>
            <RightSidebarToggle
              onClick={() => setShowRightSidebar((prev) => !prev)}
              isOpen={showRightSidebar}
            />
            {!showWelcome && (
              <div className="ml-auto min-w-0 flex-1 max-w-5xl">
                <PromptBar
                  onSubmit={handlePrompt}
                  onGenerateFromRepo={handleGenerateFromRepo}
                  isLoading={loading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar - GitHub + Model Response */}
      <RightSidebar
        isOpen={showRightSidebar}
        onClose={() => setShowRightSidebar(false)}
        onSelectRepo={handleSelectRepo}
        isLoading={loading}
        modelResponse={modelResponse}
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
