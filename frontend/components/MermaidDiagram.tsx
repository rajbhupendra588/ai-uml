"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "./ThemeProvider";
import { sanitizeMermaidCode } from "@/lib/sanitizeMermaid";

/**
 * Decode HTML entities in Mermaid code before render. Entities show as literal text
 * in SVG output. Replace with actual chars so diagram displays correctly.
 */
function decodeEntitiesInMermaid(code: string): string {
  return code
    .replace(/&#34;/g, "'")
    .replace(/&quot;/g, "'")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&#35;/g, "#")
    .replace(/&amp;/g, "&");
}

const darkThemeConfig = {
  theme: "dark" as const,
  themeVariables: {
    primaryColor: "#334155",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#475569",
    lineColor: "#64748b",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    background: "#0f172a",
    mainBkg: "#1e293b",
    nodeBorder: "#475569",
    clusterBkg: "#1e293b",
    titleColor: "#e2e8f0",
    edgeLabelBackground: "#1e293b",
  },
};

const lightThemeConfig = {
  theme: "default" as const,
  themeVariables: {
    primaryColor: "#e0e7ff",
    primaryTextColor: "#1e293b",
    primaryBorderColor: "#6366f1",
    lineColor: "#64748b",
    secondaryColor: "#f1f5f9",
    tertiaryColor: "#ffffff",
    background: "#ffffff",
    mainBkg: "#f8fafc",
    nodeBorder: "#cbd5e1",
    clusterBkg: "#f1f5f9",
    titleColor: "#1e293b",
    edgeLabelBackground: "#ffffff",
  },
};

/** Softer, cohesive palette so mind maps look organic, not blocky or harsh. */
const darkMindmapTheme = {
  theme: "dark" as const,
  themeVariables: {
    primaryColor: "#4f46e5",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#6366f1",
    lineColor: "#818cf8",
    secondaryColor: "#4338ca",
    tertiaryColor: "#3730a3",
    background: "#0f172a",
    mainBkg: "#1e1b4b",
    nodeBorder: "#6366f1",
    clusterBkg: "#1e1b4b",
    titleColor: "#e2e8f0",
    edgeLabelBackground: "#1e1b4b",
  },
};

const lightMindmapTheme = {
  theme: "default" as const,
  themeVariables: {
    primaryColor: "#c7d2fe",
    primaryTextColor: "#312e81",
    primaryBorderColor: "#818cf8",
    lineColor: "#a5b4fc",
    secondaryColor: "#e0e7ff",
    tertiaryColor: "#eef2ff",
    background: "#ffffff",
    mainBkg: "#f5f3ff",
    nodeBorder: "#a5b4fc",
    clusterBkg: "#ede9fe",
    titleColor: "#312e81",
    edgeLabelBackground: "#ffffff",
  },
};


// --- Expanded Theme Configurations ---

const baseThemeConfig = {
  theme: "base" as const,
  themeVariables: {
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export const DIAGRAM_THEMES = {
  default: {
    theme: "default" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#e0e7ff",
      primaryTextColor: "#1e293b",
      primaryBorderColor: "#6366f1",
      lineColor: "#64748b",
      secondaryColor: "#f1f5f9",
      tertiaryColor: "#ffffff",
    }
  },
  neutral: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#f1f5f9",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#cbd5e1",
      lineColor: "#64748b",
      secondaryColor: "#e2e8f0",
      tertiaryColor: "#ffffff",
    },
  },
  dark: {
    theme: "dark" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#334155",
      primaryTextColor: "#e2e8f0",
      primaryBorderColor: "#475569",
      lineColor: "#64748b",
      secondaryColor: "#1e293b",
      tertiaryColor: "#0f172a",
    }
  },
  forest: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#ecfdf5",
      primaryTextColor: "#064e3b",
      primaryBorderColor: "#34d399",
      lineColor: "#059669",
      secondaryColor: "#d1fae5",
      tertiaryColor: "#ffffff",
    },
  },
  ocean: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#eff6ff",
      primaryTextColor: "#1e3a8a",
      primaryBorderColor: "#60a5fa",
      lineColor: "#2563eb",
      secondaryColor: "#dbeafe",
      tertiaryColor: "#ffffff",
    },
  },
  sunset: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#fff7ed",
      primaryTextColor: "#7c2d12",
      primaryBorderColor: "#fb923c",
      lineColor: "#ea580c",
      secondaryColor: "#ffedd5",
      tertiaryColor: "#ffffff",
    },
  },
  purple: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#faf5ff",
      primaryTextColor: "#581c87",
      primaryBorderColor: "#c084fc",
      lineColor: "#9333ea",
      secondaryColor: "#f3e8ff",
      tertiaryColor: "#ffffff",
    },
  },
  monochrome: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#ffffff",
      primaryTextColor: "#000000",
      primaryBorderColor: "#000000",
      lineColor: "#000000",
      secondaryColor: "#ffffff",
      tertiaryColor: "#ffffff",
    },
  },
  cyberpunk: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Courier New, monospace",
      primaryColor: "#000000",
      primaryTextColor: "#00ff00",
      primaryBorderColor: "#00ff00",
      lineColor: "#00ff00",
      secondaryColor: "#111111",
      tertiaryColor: "#000000",
    },
  },
  retro: {
    theme: "base" as const,
    themeVariables: {
      fontFamily: "Georgia, serif",
      primaryColor: "#fdf6e3",
      primaryTextColor: "#586e75",
      primaryBorderColor: "#b58900",
      lineColor: "#839496",
      secondaryColor: "#eee8d5",
      tertiaryColor: "#fdf6e3",
    }
  }
};

export type DiagramTheme = keyof typeof DIAGRAM_THEMES;

/** Extract Mermaid node ID from SVG element id (e.g. "flowchart-A-0" -> "A") */
function extractNodeIdFromSvgId(svgId: string): string | null {
  if (!svgId) return null;
  const parts = svgId.split("-");
  if (parts.length >= 3) return parts.slice(1, -1).join("-");
  if (parts.length >= 2) return parts.slice(1).join("-");
  return svgId;
}

export interface MermaidDiagramProps {
  code: string;
  className?: string;
  is3D?: boolean;
  look?: "classic" | "handDrawn";
  diagramTheme?: DiagramTheme;
  fontFamily?: string;
  edgeCurve?: string; // basis, linear, step, etc.
  nodeSpacing?: number;
  rankSpacing?: number;
  customColors?: {
    nodeColor?: string;
    edgeColor?: string;
    textColor?: string;
    bgColor?: string;
  };
  backgroundPattern?: "dots" | "lines" | "cross" | "none";
  /** Map Mermaid node IDs to full code for per-node expand popover */
  nodeCodeMap?: Record<string, string>;
  /** Called when user clicks a node. Pass nodeId, optional label, and event (for ctrlKey). */
  onNodeClick?: (nodeId: string, label?: string, event?: MouseEvent) => void;
  /** Node IDs to highlight as selected (for update flow) */
  selectedNodeIds?: string[];
}

/** Inject SVG filters and apply 3D depth effect to diagram nodes. */
function apply3DEffect(svgEl: SVGSVGElement, isDark: boolean) {
  const ns = "http://www.w3.org/2000/svg";
  let defs = svgEl.querySelector("defs");
  if (!defs) { defs = document.createElementNS(ns, "defs"); svgEl.prepend(defs); }
  defs.querySelectorAll("[data-effect-3d]").forEach((el) => el.remove());

  const filter = document.createElementNS(ns, "filter");
  filter.setAttribute("id", "diagram-3d-shadow");
  filter.setAttribute("x", "-12%"); filter.setAttribute("y", "-12%");
  filter.setAttribute("width", "140%"); filter.setAttribute("height", "150%");
  filter.setAttribute("data-effect-3d", "true");

  const feBlur = document.createElementNS(ns, "feGaussianBlur");
  feBlur.setAttribute("in", "SourceAlpha"); feBlur.setAttribute("stdDeviation", "4"); feBlur.setAttribute("result", "blur");
  const feOffset = document.createElementNS(ns, "feOffset");
  feOffset.setAttribute("in", "blur"); feOffset.setAttribute("dx", "3"); feOffset.setAttribute("dy", "5"); feOffset.setAttribute("result", "offsetBlur");
  const feFlood = document.createElementNS(ns, "feFlood");
  feFlood.setAttribute("flood-color", isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)"); feFlood.setAttribute("flood-opacity", "1"); feFlood.setAttribute("result", "color");
  const feComp = document.createElementNS(ns, "feComposite");
  feComp.setAttribute("in", "color"); feComp.setAttribute("in2", "offsetBlur"); feComp.setAttribute("operator", "in"); feComp.setAttribute("result", "shadow");
  const feMerge = document.createElementNS(ns, "feMerge");
  const mn1 = document.createElementNS(ns, "feMergeNode"); mn1.setAttribute("in", "shadow");
  const mn2 = document.createElementNS(ns, "feMergeNode"); mn2.setAttribute("in", "SourceGraphic");
  feMerge.appendChild(mn1); feMerge.appendChild(mn2);
  filter.appendChild(feBlur); filter.appendChild(feOffset); filter.appendChild(feFlood); filter.appendChild(feComp); filter.appendChild(feMerge);
  defs.appendChild(filter);

  svgEl.querySelectorAll(
    ".node rect, .node polygon, .node circle, .node ellipse, .node path, .cluster rect, .label-container rect, g.node > rect, g.node > polygon, g.node > circle"
  ).forEach((s) => s.setAttribute("filter", "url(#diagram-3d-shadow)"));

  svgEl.querySelectorAll("g[id]").forEach((g) => {
    const id = g.getAttribute("id") || "";
    if (id.startsWith("flowchart-") || id.startsWith("statediagram-") || /^[A-Za-z]+-?\d*$/.test(id)) {
      g.querySelectorAll(":scope > rect, :scope > polygon, :scope > circle, :scope > ellipse").forEach((s) => {
        if (!s.getAttribute("filter")) s.setAttribute("filter", "url(#diagram-3d-shadow)");
      });
    }
  });
  svgEl.classList.add("diagram-3d-active");
}

function remove3DEffect(svgEl: SVGSVGElement) {
  svgEl.querySelectorAll("[data-effect-3d]").forEach((el) => el.remove());
  svgEl.querySelectorAll("[filter='url(#diagram-3d-shadow)']").forEach((s) => s.removeAttribute("filter"));
  svgEl.classList.remove("diagram-3d-active");
}

function isMindmap(code: string): boolean {
  const trimmed = code.trimStart();
  return trimmed.startsWith("mindmap") || (trimmed.startsWith("---") && code.includes("mindmap"));
}

export function MermaidDiagram({
  code,
  className = "",
  is3D = false,
  look = "classic",
  diagramTheme = "default",
  fontFamily,
  edgeCurve = "basis",
  nodeSpacing = 50,
  rankSpacing = 50,
  customColors,
  backgroundPattern = "dots",
  nodeCodeMap = {},
  onNodeClick,
  selectedNodeIds = [],
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const clickCleanupRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codePopover, setCodePopover] = useState<{ x: number; y: number; code: string } | null>(null);
  const { theme } = useTheme();
  const mindmap = isMindmap(code);

  useEffect(() => {
    if (!code.trim() || !diagramRef.current) return;
    setError(null);
    const id = `diagram-${Date.now()}`;
    const el = diagramRef.current;

    // Clear old content immediately to prevent "stuck" visual states
    el.innerHTML = "";

    let cancelled = false;

    // Resolve config: explicit diagramTheme > mindmap/mode-based defaults
    let config = DIAGRAM_THEMES[diagramTheme];

    // Fallback logic if "default" is selected (auto-switch based on mode)
    if (diagramTheme === "default") {
      if (mindmap) {
        config = (theme === "dark" ? darkMindmapTheme : lightMindmapTheme) as any;
      } else {
        config = (theme === "dark" ? darkThemeConfig : lightThemeConfig) as any;
      }
    }

    // START: Professional Styling Overrides
    const flowConfig = {
      curve: edgeCurve,
      nodeSpacing: nodeSpacing,
      rankSpacing: rankSpacing,
      htmlLabels: true,
      useMaxWidth: true,
    };

    // Merge into flowchart/sequence/etc specific configs
    const finalConfig = {
      ...config as any,
      flowchart: { ...((config as any).flowchart || {}), ...flowConfig },
      sequence: { ...((config as any).sequence || {}), ...flowConfig },
      state: { ...((config as any).state || {}), ...flowConfig },
      class: { ...((config as any).class || {}), ...flowConfig },
      er: { ...((config as any).er || {}), ...flowConfig },
      gantt: { ...((config as any).gantt || {}), ...flowConfig },
      journey: { ...((config as any).journey || {}), ...flowConfig },
    };
    // END: Professional Styling Overrides

    // Apply custom font if provided
    if (finalConfig.themeVariables) {
      finalConfig.themeVariables = { ...finalConfig.themeVariables };

      if (fontFamily) {
        finalConfig.themeVariables.fontFamily = fontFamily;
      }

      // Apply custom color overrides
      if (customColors) {
        if (customColors.nodeColor) {
          finalConfig.themeVariables.primaryColor = customColors.nodeColor;
        }
        if (customColors.edgeColor) {
          finalConfig.themeVariables.lineColor = customColors.edgeColor;
          finalConfig.themeVariables.primaryBorderColor = customColors.edgeColor;
          finalConfig.themeVariables.nodeBorder = customColors.edgeColor;
        }
        if (customColors.textColor) {
          finalConfig.themeVariables.primaryTextColor = customColors.textColor;
          finalConfig.themeVariables.titleColor = customColors.textColor;
          // output text color?
        }
        if (customColors.bgColor) {
          finalConfig.themeVariables.background = customColors.bgColor;
          finalConfig.themeVariables.mainBkg = customColors.bgColor;
        }
      }
    }

    mermaid.initialize({
      startOnLoad: false,
      look: look || "classic",
      ...finalConfig,
      // Enhanced accessibility and interaction
      securityLevel: "loose",
    });

    const cleanCode = decodeEntitiesInMermaid(sanitizeMermaidCode(code ?? "") || "");
    mermaid
      .render(id, cleanCode)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !el) return;
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-diagram-fit";
        // Create a card-like effect for the diagram to sit on top of the pattern cleanly
        wrapper.style.cssText =
          "width:100%;height:100%;display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;";
        wrapper.innerHTML = svg;
        el.innerHTML = "";
        el.appendChild(wrapper);
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.maxHeight = "100%";
          svgEl.style.width = "auto";
          svgEl.style.height = "auto";
          if (!svgEl.hasAttribute("preserveAspectRatio")) {
            svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
          }
          if (mindmap) svgEl.classList.add("mermaid-mindmap-svg");
          if (is3D) apply3DEffect(svgEl, theme === "dark");
        }
        bindFunctions?.(el);
        const handlers: Array<() => void> = [];
        // Attach click handlers for nodes with code (per-node expand)
        if (Object.keys(nodeCodeMap).length > 0 && svgEl) {
          svgEl.querySelectorAll("g[id]").forEach((g) => {
            const id = g.getAttribute("id") || "";
            for (const nodeId of Object.keys(nodeCodeMap)) {
              if (id === nodeId || id.endsWith("-" + nodeId) || id.includes(nodeId)) {
                const fullCode = nodeCodeMap[nodeId];
                if (!fullCode) continue;
                const group = g.closest("g") || g;
                (group as HTMLElement).style.cursor = "pointer";
                const onClick = (e: Event) => {
                  e.stopPropagation();
                  const ev = e as MouseEvent;
                  setCodePopover((prev) => {
                    if (prev?.code === fullCode) return null;
                    return { x: ev.clientX, y: ev.clientY, code: fullCode };
                  });
                };
                group.addEventListener("click", onClick);
                handlers.push(() => group.removeEventListener("click", onClick));
                break;
              }
            }
          });
        }
        // Attach node click for selection (onNodeClick)
        if (onNodeClick && svgEl) {
          svgEl.querySelectorAll("g.node, g[id^='flowchart-'], g[id^='statediagram-'], g[id^='graph-']").forEach((g) => {
            const id = g.getAttribute("id") || "";
            if (id.includes("edge") || id.includes("Line") || id.includes("cluster")) return;
            const nodeId = extractNodeIdFromSvgId(id) || id;
            if (!nodeId) return;
            const group = g as HTMLElement;
            group.style.cursor = "pointer";
            const labelEl = g.querySelector(".label, .nodeLabel, tspan");
            const label = labelEl?.textContent?.trim() || nodeId;
            const onClick = (e: Event) => {
              e.stopPropagation();
              onNodeClick(nodeId, label, e as MouseEvent);
            };
            group.addEventListener("click", onClick);
            handlers.push(() => group.removeEventListener("click", onClick));
          });
        }
        clickCleanupRef.current = handlers.length ? () => handlers.forEach((h) => h()) : null;
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Could not render diagram.");
      });

    return () => {
      cancelled = true;
      clickCleanupRef.current?.();
    };
  }, [code, theme, mindmap, is3D, look, diagramTheme, fontFamily, customColors, edgeCurve, nodeSpacing, rankSpacing, nodeCodeMap, onNodeClick]);

  // Apply selection highlight when selectedNodeIds changes - clearly visible in diagram
  useEffect(() => {
    if (!diagramRef.current) return;
    const svgEl = diagramRef.current.querySelector("svg");
    if (!svgEl) return;
    const selectedSet = new Set(selectedNodeIds);
    svgEl.querySelectorAll("g.node, g[id^='flowchart-'], g[id^='statediagram-'], g[id^='graph-']").forEach((g) => {
      const id = g.getAttribute("id") || "";
      if (id.includes("edge") || id.includes("Line") || id.includes("cluster")) return;
      const nodeId = extractNodeIdFromSvgId(id) || id;
      const isSelected = selectedSet.has(nodeId) || selectedSet.has(id);
      g.classList.toggle("diagram-node-selected", isSelected);
      const shapes = g.querySelectorAll("rect, polygon, circle, ellipse, path");
      shapes.forEach((shape) => {
        const el = shape as SVGElement;
        if (isSelected) {
          el.style.stroke = "#6366f1";
          el.style.strokeWidth = "4px";
          el.style.strokeDasharray = "6 4";
          el.setAttribute("stroke", "#6366f1");
          el.setAttribute("stroke-width", "4");
          el.setAttribute("stroke-dasharray", "6 4");
        } else {
          el.style.stroke = "";
          el.style.strokeWidth = "";
          el.style.strokeDasharray = "";
          el.removeAttribute("stroke");
          el.removeAttribute("stroke-width");
          el.removeAttribute("stroke-dasharray");
        }
      });
    });
  }, [selectedNodeIds]);

  useEffect(() => {
    if (!diagramRef.current) return;
    const svgEl = diagramRef.current.querySelector("svg");
    if (!svgEl) return;
    if (is3D) apply3DEffect(svgEl, theme === "dark");
    else remove3DEffect(svgEl);
  }, [is3D, theme]);

  if (!code.trim()) return null;

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-auto bg-canvas p-6 transition-colors duration-300 relative ${mindmap ? "mermaid-mindmap-container" : ""} ${className}`}
    >
      {/* Background Pattern Layer - Rendered independently */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{
        backgroundImage: backgroundPattern === 'dots'
          ? `radial-gradient(${theme === 'dark' ? '#94a3b8' : '#222'} 1px, transparent 1px)`
          : backgroundPattern === 'lines'
            ? `linear-gradient(${theme === 'dark' ? '#94a3b8' : '#222'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'dark' ? '#94a3b8' : '#222'} 1px, transparent 1px)`
            : backgroundPattern === 'cross'
              ? `radial-gradient(${theme === 'dark' ? '#94a3b8' : '#222'} 2px, transparent 2px), radial-gradient(${theme === 'dark' ? '#94a3b8' : '#222'} 1px, transparent 1px)`
              : 'none',
        backgroundSize: backgroundPattern === 'dots'
          ? '20px 20px'
          : backgroundPattern === 'lines'
            ? '20px 20px'
            : backgroundPattern === 'cross'
              ? '30px 30px'
              : 'auto',
        backgroundPosition: 'center',
      }} />

      {/* Render Diagram in a separate localized container to allow background to persist underneath */}
      <div ref={diagramRef} className="z-10 relative flex-1 min-w-0 min-h-0 flex items-center justify-center w-full h-full" />

      {/* Code popover (per-node expand) */}
      {codePopover && (
        <>
          <div
            className="fixed inset-0 z-50"
            aria-hidden="true"
            onClick={() => setCodePopover(null)}
          />
          <div
            className="fixed z-50 max-w-md max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl p-3 text-sm font-mono whitespace-pre-wrap"
            style={{ left: Math.min(codePopover.x, window.innerWidth - 340), top: Math.min(codePopover.y + 8, window.innerHeight - 280) }}
            role="dialog"
            aria-label="Full code"
          >
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={() => setCodePopover(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs"
              >
                Close
              </button>
            </div>
            <pre className="text-xs text-[var(--foreground)] overflow-x-auto">{codePopover.code}</pre>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-amber-500 z-20 absolute bottom-4" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
