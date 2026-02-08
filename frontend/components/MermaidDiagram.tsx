"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "./ThemeProvider";

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

export interface MermaidDiagramProps {
  code: string;
  className?: string;
  is3D?: boolean;
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

export function MermaidDiagram({ code, className = "", is3D = false }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const mindmap = isMindmap(code);

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return;
    setError(null);
    const id = `diagram-${Date.now()}`;
    const el = containerRef.current;
    let cancelled = false;

    const baseConfig = theme === "dark" ? darkThemeConfig : lightThemeConfig;
    const mindmapConfig = theme === "dark" ? darkMindmapTheme : lightMindmapTheme;
    const config = mindmap ? mindmapConfig : baseConfig;
    mermaid.initialize({
      startOnLoad: false,
      ...config,
    });

    mermaid
      .render(id, code)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !el) return;
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-diagram-fit";
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
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Could not render diagram.");
      });

    return () => { cancelled = true; };
  }, [code, theme, mindmap, is3D]);

  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;
    if (is3D) apply3DEffect(svgEl, theme === "dark");
    else remove3DEffect(svgEl);
  }, [is3D, theme]);

  if (!code.trim()) return null;

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-auto bg-canvas p-6 transition-colors duration-300 ${mindmap ? "mermaid-mindmap-container" : ""} ${className}`}
    >
      {error && (
        <p className="text-sm text-amber-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
