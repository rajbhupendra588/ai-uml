"use client";

import React, { useState } from "react";
import { Github, Cpu, ChevronRight, ChevronDown, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubReposPanel } from "./GitHubReposPanel";
import { type ModelResponse } from "./ModelResponsePanel";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (repoUrl: string) => void;
  isLoading: boolean;
  modelResponse: ModelResponse | null;
}

export function RightSidebar({
  isOpen,
  onClose,
  onSelectRepo,
  isLoading,
  modelResponse,
}: RightSidebarProps) {
  const [githubExpanded, setGithubExpanded] = useState(true);
  const [modelExpanded, setModelExpanded] = useState(false);

  const nodeCount = modelResponse?.nodes?.length ?? 0;

  return (
    <div
      className={cn(
        "shrink-0 border-l border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out flex flex-col",
        isOpen ? "w-80" : "w-0"
      )}
      style={{ overflow: "hidden" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
        <span className="text-sm font-medium text-[var(--foreground)]">Panels</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Close sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Panels container - flex column with proper ordering */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Expanded panels take available space - always mount content so state is preserved when collapsed */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* GitHub Panel - always mounted, visibility controlled by CSS */}
          <div
            className={cn(
              "flex flex-col min-h-0 border-b border-[var(--border)] transition-all duration-200 overflow-hidden",
              githubExpanded ? "flex-1" : "flex-none max-h-0 min-h-0 opacity-0 pointer-events-none"
            )}
          >
            <CollapsibleHeader
              title="GitHub Repos"
              icon={<Github className="h-4 w-4" />}
              isExpanded={githubExpanded}
              onToggle={() => setGithubExpanded(false)}
            />
            <div className="flex-1 overflow-y-auto min-h-0">
              <GitHubReposPanel
                onSelectRepo={onSelectRepo}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Model Response Panel - always mounted, visibility controlled by CSS */}
          <div
            className={cn(
              "flex flex-col min-h-0 border-b border-[var(--border)] transition-all duration-200 overflow-hidden",
              modelExpanded ? "flex-1" : "flex-none max-h-0 min-h-0 opacity-0 pointer-events-none"
            )}
          >
            <CollapsibleHeader
              title="Model Response"
              icon={<Cpu className="h-4 w-4" />}
              isExpanded={modelExpanded}
              onToggle={() => setModelExpanded(false)}
              badge={nodeCount > 0 ? `${nodeCount} nodes` : undefined}
            />
            <div className="flex-1 overflow-y-auto min-h-0">
              <ModelResponseInline response={modelResponse} />
            </div>
          </div>
        </div>

        {/* Collapsed panels stack at the bottom */}
        <div className="shrink-0">
          {!modelExpanded && (
            <CollapsibleHeader
              title="Model Response"
              icon={<Cpu className="h-4 w-4" />}
              isExpanded={false}
              onToggle={() => {
                setModelExpanded(true);
                setGithubExpanded(false);
              }}
              badge={nodeCount > 0 ? `${nodeCount}` : undefined}
            />
          )}
          {!githubExpanded && (
            <CollapsibleHeader
              title="GitHub Repos"
              icon={<Github className="h-4 w-4" />}
              isExpanded={false}
              onToggle={() => {
                setGithubExpanded(true);
                setModelExpanded(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Collapsible section header
interface CollapsibleHeaderProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: string;
}

function CollapsibleHeader({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
}: CollapsibleHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2.5 text-left transition border-b border-[var(--border)]",
        isExpanded
          ? "bg-[var(--secondary)] hover:bg-[var(--accent)]"
          : "bg-[var(--card)] hover:bg-[var(--secondary)]"
      )}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-[var(--primary)] shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-[var(--muted)] shrink-0" />
      )}
      <span className={cn("shrink-0", isExpanded ? "text-[var(--primary)]" : "text-[var(--muted)]")}>
        {icon}
      </span>
      <span className={cn(
        "text-sm font-medium flex-1",
        isExpanded ? "text-[var(--foreground)]" : "text-[var(--muted)]"
      )}>
        {title}
      </span>
      {badge && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          isExpanded ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--accent)] text-[var(--muted)]"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Inline version of model response
function ModelResponseInline({ response }: { response: ModelResponse | null }) {
  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Cpu className="h-10 w-10 text-[var(--muted)] mb-3" />
        <p className="text-sm text-[var(--muted)]">No diagram generated yet</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Generate a diagram to see the model response
        </p>
      </div>
    );
  }

  const { nodes = [], edges = [], explanation } = response;

  return (
    <div className="p-3 space-y-3">
      {explanation && (
        <div className="rounded-lg bg-[var(--secondary)] p-3">
          <p className="text-xs font-medium text-[var(--primary)] mb-1">Explanation</p>
          <p className="text-xs text-[var(--foreground)] leading-relaxed">{explanation}</p>
        </div>
      )}

      {nodes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--muted)] mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Nodes ({nodes.length})
          </p>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {nodes.slice(0, 25).map((node, i) => (
              <div
                key={node.id || i}
                className="flex items-center gap-2 rounded bg-[var(--secondary)] px-2 py-1.5 text-xs"
              >
                <span className="text-[var(--muted)] font-mono">{node.id}</span>
                <span className="text-[var(--foreground)] truncate">
                  {typeof node.data?.label === "string"
                    ? node.data.label
                    : node.type || "node"}
                </span>
              </div>
            ))}
            {nodes.length > 25 && (
              <p className="text-xs text-[var(--muted)] px-2">
                +{nodes.length - 25} more...
              </p>
            )}
          </div>
        </div>
      )}

      {edges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--muted)] mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Edges ({edges.length})
          </p>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {edges.slice(0, 15).map((edge, i) => (
              <div
                key={edge.id || i}
                className="flex items-center gap-1 text-xs text-[var(--muted)] px-2"
              >
                <span className="font-mono">{edge.source}</span>
                <span className="text-[var(--muted-foreground)]">→</span>
                <span className="font-mono">{edge.target}</span>
                {edge.label && (
                  <span className="text-[var(--muted-foreground)] truncate ml-1">({edge.label})</span>
                )}
              </div>
            ))}
            {edges.length > 15 && (
              <p className="text-xs text-[var(--muted)] px-2">
                +{edges.length - 15} more...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Toggle button for the right sidebar
interface RightSidebarToggleProps {
  onClick: () => void;
  isOpen: boolean;
}

export function RightSidebarToggle({ onClick, isOpen }: RightSidebarToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition",
        isOpen
          ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
      )}
      title={isOpen ? "Hide panels" : "Show panels"}
    >
      <PanelRightClose className={cn("h-4 w-4", !isOpen && "rotate-180")} />
      <span className="hidden sm:inline">Panels</span>
    </button>
  );
}
