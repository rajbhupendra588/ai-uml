"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
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
  getModelsUrl,
  DEFAULT_MODELS,
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

const EMPTY_NODES: Node[] = [];

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(EMPTY_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);
  const [diagramType, setDiagramType] = useState<DiagramType>("architecture");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [modelResponse, setModelResponse] = useState<ModelResponse | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODELS[0]?.id ?? "arcee-ai/trinity-large-preview:free");
  const [isExporting, setIsExporting] = useState(false);
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<EditingNode | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [contextMessages, setContextMessages] = useState<ContextMessage[]>([]);
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
      const newEdge = {
        ...params,
        type: "mermaid",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

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
    lastPromptRef.current = prompt;
    setLoading(true);
    try {
      const response = await fetch(getGenerateUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, diagram_type: diagramType, model: selectedModel }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
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

      if (mermaidCode) {
        setDiagramCode(mermaidCode);
        setNodes(EMPTY_NODES);
        setEdges([]);
        // Add to context history
        setContextMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: prompt,
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
  }, [diagramType, selectedModel, setNodes, setEdges]);

  const handleGenerateFromRepo = useCallback(
    async (repoUrl: string) => {
      setLoading(true);
      try {
        const response = await fetch(getGenerateFromRepoUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_url: repoUrl,
            diagram_type: diagramType,
            model: selectedModel,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const message =
            typeof data.detail === "string"
              ? data.detail
              : "Repo analysis or diagram generation failed. Please try again.";
          toast.error(message);
          return;
        }

        const mermaidCode = data.mermaid ?? "";
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

        if (mermaidCode) {
          setDiagramCode(mermaidCode);
          setNodes(EMPTY_NODES);
          setEdges([]);
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
    requestAnimationFrame(() => {
      exportFn().finally(() => setIsExporting(false));
    });
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => openEditForNode(node),
    [openEditForNode]
  );

  const handleEditSave = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
      setEditingNode(null);
      toast.success("Node updated");
    },
    [setNodes]
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

  const handleClearContextHistory = useCallback(() => {
    setContextMessages([]);
    toast.success("Context history cleared");
  }, []);

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
        onClearHistory={handleClearContextHistory}
        isLoading={loading}
        isOpen={showContextPanel}
        onClose={() => setShowContextPanel(false)}
      />

      {/* Main content area */}
      <div 
        className="grid h-full min-w-0 flex-1 bg-canvas transition-colors duration-300" 
        style={{ gridTemplateRows: "1fr auto" }}
      >
        {/* Main diagram area - takes remaining space */}
        <div
          ref={flowContainerRef}
          data-exporting={isExporting ? "true" : undefined}
          className="relative overflow-hidden bg-canvas transition-colors duration-300 data-[exporting=true]:[&_[data-diagram-download-hide]]:invisible"
        >
          {diagramCode ? (
            <MermaidDiagram code={diagramCode} className="h-full w-full" />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
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
              <Controls 
                className="!bg-[var(--card)] !border-[var(--border)] !shadow-lg"
                showZoom
                showFitView
                showInteractive={false}
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
          {!showWelcome && (
            <DiagramDownloadMenu
              containerRef={flowContainerRef}
              diagramType={diagramType}
              nodes={nodes}
              edges={edges}
              diagramCode={diagramCode}
              onPrepareExport={handlePrepareExport}
              disabled={loading}
            />
          )}

          {explanation && !showWelcome && (
            <div data-diagram-download-hide className="absolute left-3 right-3 top-12 z-10 max-w-2xl rounded border border-slate-700/80 bg-slate-800/95 px-3 py-2">
              <p className="text-xs font-medium text-indigo-400">How it works</p>
              <p className="mt-0.5 text-sm text-slate-300">{explanation}</p>
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
            <ThemeToggle />
            <RightSidebarToggle
              onClick={() => setShowRightSidebar((prev) => !prev)}
              isOpen={showRightSidebar}
            />
            {!showWelcome && (
              <div className="ml-auto min-w-0 flex-1 max-w-2xl">
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
