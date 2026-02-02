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

export interface MermaidDiagramProps {
  code: string;
  className?: string;
}

export function MermaidDiagram({ code, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return;
    setError(null);
    const id = `diagram-${Date.now()}`;
    const el = containerRef.current;
    let cancelled = false;

    // Re-initialize mermaid with the current theme
    const config = theme === "dark" ? darkThemeConfig : lightThemeConfig;
    mermaid.initialize({
      startOnLoad: false,
      ...config,
    });

    mermaid
      .render(id, code)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !el) return;
        el.innerHTML = svg;
        const svgEl = el.querySelector("svg");
        if (svgEl) {
          // Ensure SVG has explicit dimensions for proper export
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
        }
        bindFunctions?.(el);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Could not render diagram.");
      });

    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  if (!code.trim()) return null;

  return (
    <div
      ref={containerRef}
      className={`flex min-h-full min-w-0 items-center justify-center overflow-auto bg-canvas p-6 transition-colors duration-300 ${className}`}
    >
      {error && (
        <p className="text-sm text-amber-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
