"use client";

import React from "react";
import { Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HLD_LAYERS = [
  "presentation",
  "application",
  "business",
  "data",
  "external",
  "infrastructure",
] as const;

interface HldComponentsPanelProps {
  diagramPlan: Record<string, unknown> | null;
  diagramType: string;
  onGenerateLld: (componentName: string) => void;
  isLoading: boolean;
  className?: string;
}

/** Flatten HLD layers into a list of { name, tech, layer } for drill-down. */
function flattenHldComponents(plan: Record<string, unknown>): Array<{ name: string; tech: string; layer: string }> {
  const layers = plan.layers as Record<string, Array<{ name?: string; tech?: string }>> | undefined;
  if (!layers || typeof layers !== "object") return [];

  const result: Array<{ name: string; tech: string; layer: string }> = [];
  for (const layerKey of HLD_LAYERS) {
    const items = layers[layerKey];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === "object" && item.name) {
        result.push({
          name: String(item.name).trim(),
          tech: (item.tech && String(item.tech).trim()) || "",
          layer: layerKey,
        });
      }
    }
  }
  return result;
}

export function HldComponentsPanel({
  diagramPlan,
  diagramType,
  onGenerateLld,
  isLoading,
  className,
}: HldComponentsPanelProps) {
  if (diagramType !== "hld" || !diagramPlan?.layers) {
    return null;
  }

  const components = flattenHldComponents(diagramPlan);
  if (components.length === 0) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--muted)]">
        <Layers className="h-3.5 w-3.5" />
        <span>Generate LLD for component</span>
      </div>
      <div className="space-y-1 max-h-[200px] overflow-y-auto px-2 pb-2">
        {components.map((c, i) => (
          <div
            key={`${c.layer}-${c.name}-${i}`}
            className="flex items-center justify-between gap-2 rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-[var(--foreground)] truncate block">{c.name}</span>
              {c.tech && (
                <span className="text-[10px] text-[var(--muted)] truncate block">{c.tech}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onGenerateLld(c.name)}
              disabled={isLoading}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition",
                "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
                "hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)]",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
              title={`Generate low-level design for ${c.name}`}
            >
              <ChevronRight className="h-3 w-3" />
              LLD
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
