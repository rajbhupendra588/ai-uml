"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Pencil,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Layout,
    Type,
    Palette,
    Grid,
    ArrowRight,
    ArrowDown,
    Activity,
    Code2
} from "lucide-react";
import { DIAGRAM_THEMES, DiagramTheme } from "./MermaidDiagram";

interface DiagramControlsPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    diagramType: string;
    // Style controls
    look: "classic" | "handDrawn";
    setLook: (look: "classic" | "handDrawn") => void;
    is3D: boolean;
    setIs3D: (is3D: boolean) => void;
    diagramTheme: DiagramTheme;
    setDiagramTheme: (theme: DiagramTheme) => void;
    diagramFont: string;
    setDiagramFont: (font: string) => void;
    // Show code toggle
    showCode: boolean;
    setShowCode: (show: boolean) => void;
    // Version selector
    diagramVersions: Array<{ layout: string; code: string; direction: string; description: string }>;
    selectedVersionIndex: number;
    onVersionChange: (index: number, code: string) => void;
    // Custom Colors
    customColors: {
        nodeColor?: string;
        edgeColor?: string;
        textColor?: string;
        bgColor?: string;
    };
    setCustomColors: (colors: {
        nodeColor?: string;
        edgeColor?: string;
        textColor?: string;
        bgColor?: string;
    }) => void;
    // Advanced Styling
    backgroundPattern: "dots" | "lines" | "cross" | "none";
    setBackgroundPattern: (pattern: "dots" | "lines" | "cross" | "none") => void;
    edgeCurve: string;
    setEdgeCurve: (curve: string) => void;
    spacing: "compact" | "normal" | "wide";
    setSpacing: (spacing: "compact" | "normal" | "wide") => void;
    layoutDirection: string;
    setLayoutDirection: (dir: string) => void;
    canvasLayout: "auto" | "adaptive" | "horizontal";
    setCanvasLayout: (layout: "auto" | "adaptive" | "horizontal") => void;
    onEditCode?: () => void;
    // Code detail (when diagram has code in nodes)
    codeDetailLevel?: "small" | "complete";
    setCodeDetailLevel?: (level: "small" | "complete") => void;
    diagramPlan?: Record<string, unknown> | null;
}

function CollapsibleSection({
    title,
    icon: Icon,
    children,
    defaultOpen = false,
    className
}: {
    title: string;
    icon?: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={cn("py-3 border-b border-[var(--border)] last:border-0", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between text-xs font-semibold text-[var(--foreground)] hover:opacity-80 transition-opacity"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                    <span>{title}</span>
                </div>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
            </button>
            {isOpen && <div className="mt-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
                {children}
            </div>}
        </div>
    );
}

export function DiagramControlsPanel({
    isOpen,
    onToggle,
    diagramType,
    look,
    setLook,
    is3D,
    setIs3D,
    diagramTheme,
    setDiagramTheme,
    diagramFont,
    setDiagramFont,
    showCode,
    setShowCode,
    diagramVersions,
    selectedVersionIndex,
    onVersionChange,
    customColors,
    setCustomColors,
    backgroundPattern,
    setBackgroundPattern,
    edgeCurve,
    setEdgeCurve,
    spacing,
    setSpacing,
    layoutDirection,
    setLayoutDirection,
    canvasLayout,
    setCanvasLayout,
    onEditCode,
    codeDetailLevel = "small",
    setCodeDetailLevel,
    diagramPlan = null,
}: DiagramControlsPanelProps) {
    const isFlowchart = ["architecture", "flowchart", "graph", "state", "class"].some(t => diagramType.includes(t) || diagramType === "chat");

    const hasCodeInPlan = (p: Record<string, unknown> | null): boolean => {
        if (!p) return false;
        const check = (obj: unknown): boolean => {
            if (typeof obj === "object" && obj !== null) {
                const o = obj as Record<string, unknown>;
                if ("code" in o && o.code) return true;
                if ("snippet" in o && o.snippet) return true;
                if (Array.isArray(obj)) return obj.some(check);
                return Object.values(obj).some(check);
            }
            return false;
        };
        return check(p);
    };
    const showCodeDetail = hasCodeInPlan(diagramPlan) && setCodeDetailLevel;

    return (
        <>
            <button
                onClick={onToggle}
                className="absolute left-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] shadow-lg hover:bg-[var(--secondary)] transition-colors"
                title={isOpen ? "Hide controls" : "Show controls"}
            >
                {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            <div
                className={cn(
                    "absolute left-0 top-0 bottom-0 z-20 w-72 border-r border-[var(--border)] bg-[var(--card)] shadow-xl transition-transform duration-300 overflow-y-auto",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="p-4 pt-14 pb-8">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-4 px-1">Diagram Controls</h3>

                    {showCodeDetail && (
                        <CollapsibleSection title="Code Detail" icon={Code2} defaultOpen={false}>
                            <p className="text-[10px] text-[var(--muted-foreground)] mb-2">Show code in nodes</p>
                            <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                                {(["small", "complete"] as const).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setCodeDetailLevel!(level)}
                                        className={cn(
                                            "flex-1 py-1.5 text-xs font-medium transition-colors capitalize",
                                            codeDetailLevel === level
                                                ? "bg-[var(--primary)] text-white"
                                                : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
                                        )}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}

                    {diagramVersions.length > 1 && (
                        <CollapsibleSection title="Versions" defaultOpen={true}>
                            <div className="flex flex-wrap gap-1">
                                {diagramVersions.map((v, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onVersionChange(idx, v.code)}
                                        className={cn(
                                            "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                                            selectedVersionIndex === idx
                                                ? "bg-[var(--primary)] text-white shadow-md"
                                                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/70"
                                        )}
                                    >
                                        {v.layout || `v${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}

                    <CollapsibleSection title="Layout & Spacing" icon={Layout} defaultOpen={true}>
                        {isFlowchart && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Direction</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {["TD", "LR", "BT", "RL"].map((dir) => (
                                        <button
                                            key={dir}
                                            onClick={() => setLayoutDirection(dir)}
                                            className={cn(
                                                "flex flex-col items-center justify-center rounded py-1.5 text-[10px] font-medium transition-colors border",
                                                layoutDirection === dir
                                                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                                    : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
                                            )}
                                        >
                                            {dir === "TD" && <ArrowDown className="h-3 w-3 mb-0.5" />}
                                            {dir === "LR" && <ArrowRight className="h-3 w-3 mb-0.5" />}
                                            {dir}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Density</label>
                            <div className="flex rounded-md shadow-sm border border-[var(--border)] overflow-hidden">
                                {["compact", "normal", "wide"].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSpacing(s as any)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                                            spacing === s
                                                ? "bg-[var(--primary)] text-white"
                                                : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
                                        )}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Canvas Layout" icon={Layout} defaultOpen={false}>
                        <p className="text-[10px] text-[var(--muted-foreground)] mb-2">View mode for diagram</p>
                        <div className="flex rounded-md shadow-sm border border-[var(--border)] overflow-hidden">
                            {["auto", "adaptive", "horizontal"].map((layout) => (
                                <button
                                    key={layout}
                                    onClick={() => setCanvasLayout(layout as any)}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                                        canvasLayout === layout
                                            ? "bg-[var(--primary)] text-white"
                                            : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
                                    )}
                                >
                                    {layout}
                                </button>
                            ))}
                        </div>
                    </CollapsibleSection>


                    <CollapsibleSection title="Style & Effects" icon={Palette} defaultOpen={true}>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Line Style</label>
                            <div className="grid grid-cols-3 gap-1">
                                {[{ id: "monotoneX", label: "Smooth" }, { id: "linear", label: "Straight" }, { id: "step", label: "Step" }].map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setEdgeCurve(c.id)}
                                        className={cn(
                                            "rounded py-1.5 text-[10px] font-medium transition-colors border",
                                            edgeCurve === c.id
                                                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                                : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
                                        )}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                                onClick={() => setLook(look === "handDrawn" ? "classic" : "handDrawn")}
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors border",
                                    look === "handDrawn"
                                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                        : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
                                )}
                            >
                                <Pencil className="h-3 w-3" />
                                Hand-drawn
                            </button>
                            <button
                                onClick={() => setIs3D(!is3D)}
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors border",
                                    is3D
                                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                        : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
                                )}
                            >
                                <span className="text-xs">🎨</span>
                                3D Effect
                            </button>
                        </div>

                        <div className="space-y-2 mt-3">
                            <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Canvas Background</label>
                            <div className="grid grid-cols-4 gap-1">
                                {["dots", "lines", "cross", "none"].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setBackgroundPattern(p as any)}
                                        className={cn(
                                            "rounded py-1.5 text-[10px] font-medium transition-colors border capitalize",
                                            backgroundPattern === p
                                                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                                                : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Theme Keys" icon={Grid} defaultOpen={false}>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {Object.keys(DIAGRAM_THEMES).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setDiagramTheme(t as DiagramTheme)}
                                    className={cn(
                                        "w-full rounded px-3 py-2 text-left text-xs capitalize transition-colors hover:bg-[var(--secondary)] flex items-center gap-2 border border-transparent",
                                        diagramTheme === t
                                            ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium border-[var(--primary)]/20"
                                            : "text-[var(--foreground)]"
                                    )}
                                >
                                    <span
                                        className="h-3 w-3 rounded-full border border-white/10 flex-shrink-0"
                                        style={{ backgroundColor: DIAGRAM_THEMES[t as DiagramTheme].themeVariables?.primaryColor }}
                                    ></span>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Typography" icon={Type} defaultOpen={false}>
                        <div className="space-y-1">
                            {["Inter, sans-serif", "Roboto, sans-serif", "Courier New, monospace", "Georgia, serif", "Comic Sans MS, cursive"].map((font) => (
                                <button
                                    key={font}
                                    onClick={() => setDiagramFont(font)}
                                    className={cn(
                                        "w-full rounded px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--secondary)] border border-transparent truncate",
                                        diagramFont === font
                                            ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium border-[var(--primary)]/20"
                                            : "text-[var(--foreground)]"
                                    )}
                                    style={{ fontFamily: font }}
                                >
                                    {font.split(",")[0]}
                                </button>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Custom Override" defaultOpen={false}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-[var(--muted-foreground)] block">Nodes</label>
                                <div className="flex items-center gap-2 border border-[var(--border)] rounded p-1 bg-[var(--background)]">
                                    <input
                                        type="color"
                                        value={customColors.nodeColor || "#e0e7ff"}
                                        onChange={(e) => setCustomColors({ ...customColors, nodeColor: e.target.value })}
                                        className="h-6 w-8 cursor-pointer rounded border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={() => setCustomColors({ ...customColors, nodeColor: undefined })}
                                        className="text-[10px] text-[var(--muted)] hover:text-red-500 px-1"
                                        title="Reset"
                                    >×</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[var(--muted-foreground)] block">Edges</label>
                                <div className="flex items-center gap-2 border border-[var(--border)] rounded p-1 bg-[var(--background)]">
                                    <input
                                        type="color"
                                        value={customColors.edgeColor || "#64748b"}
                                        onChange={(e) => setCustomColors({ ...customColors, edgeColor: e.target.value })}
                                        className="h-6 w-8 cursor-pointer rounded border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={() => setCustomColors({ ...customColors, edgeColor: undefined })}
                                        className="text-[10px] text-[var(--muted)] hover:text-red-500 px-1"
                                        title="Reset"
                                    >×</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[var(--muted-foreground)] block">Text</label>
                                <div className="flex items-center gap-2 border border-[var(--border)] rounded p-1 bg-[var(--background)]">
                                    <input
                                        type="color"
                                        value={customColors.textColor || "#1e293b"}
                                        onChange={(e) => setCustomColors({ ...customColors, textColor: e.target.value })}
                                        className="h-6 w-8 cursor-pointer rounded border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={() => setCustomColors({ ...customColors, textColor: undefined })}
                                        className="text-[10px] text-[var(--muted)] hover:text-red-500 px-1"
                                        title="Reset"
                                    >×</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[var(--muted-foreground)] block">Background</label>
                                <div className="flex items-center gap-2 border border-[var(--border)] rounded p-1 bg-[var(--background)]">
                                    <input
                                        type="color"
                                        value={customColors.bgColor || "#ffffff"}
                                        onChange={(e) => setCustomColors({ ...customColors, bgColor: e.target.value })}
                                        className="h-6 w-8 cursor-pointer rounded border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={() => setCustomColors({ ...customColors, bgColor: undefined })}
                                        className="text-[10px] text-[var(--muted)] hover:text-red-500 px-1"
                                        title="Reset"
                                    >×</button>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
                        {onEditCode && (
                            <button
                                onClick={onEditCode}
                                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/70"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit Code
                            </button>
                        )}
                        <button
                            onClick={() => setShowCode(!showCode)}
                            className={cn(
                                "w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                                showCode
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/70"
                            )}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            {showCode ? "Show Diagram" : "Show Code"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
