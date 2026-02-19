"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MermaidDiagram, type DiagramTheme, DIAGRAM_THEMES } from "./MermaidDiagram";
import { useTheme } from "./ThemeProvider";
import { DiagramDownloadMenu } from "./DiagramDownloadMenu";
import { DiagramZoomControls } from "./DiagramZoomControls";
import { useAuth } from "@/components/AuthProvider";
import { MERMAID_EXAMPLES } from "@/lib/examples";
import {
    Copy,
    Check,
    Moon,
    Sun,
    RefreshCcw,
    Pencil,
    FolderOpen,
    LayoutTemplate,
    Code2,
    Palette
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tokenizeMermaidCode, SYNTAX_COLORS } from "@/lib/mermaidSyntaxHighlight";



export function LiveEditor({ initialCode }: { initialCode?: string }) {
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
    const [code, setCode] = useState(initialCode || MERMAID_EXAMPLES["Flowchart"]);

    // Update code when initialCode changes (if switching from canvas)
    useEffect(() => {
        if (initialCode) setCode(initialCode);
    }, [initialCode]);
    const [autoSync, setAutoSync] = useState(true);
    const [is3D, setIs3D] = useState(false);
    const [look, setLook] = useState<"classic" | "handDrawn">("classic");
    const [diagramTheme, setDiagramTheme] = useState<DiagramTheme>("default");
    const [diagramFont, setDiagramFont] = useState<string>("Inter, sans-serif");
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const [debouncedCode, setDebouncedCode] = useState(code);
    const [copying, setCopying] = useState(false);

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Debounce code updates for preview
    useEffect(() => {
        if (autoSync) {
            const timer = setTimeout(() => {
                setDebouncedCode(code);
            }, 500); // 500ms debounce
            return () => clearTimeout(timer);
        }
    }, [code, autoSync]);

    const handleManualSync = () => {
        setDebouncedCode(code);
        toast.success("Diagram synced");
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopying(true);
            toast.success("Code copied to clipboard");
            setTimeout(() => setCopying(false), 2000);
        } catch (err) {
            toast.error("Failed to copy code");
        }
    };

    const handleExampleSelect = (key: string) => {
        if (confirm("This will replace your current code. Continue?")) {
            setCode(MERMAID_EXAMPLES[key]);
        }
    };

    return (
        <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col bg-[var(--background)]">
            {/* Toolbar */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[var(--foreground)]">
                        <Code2 className="h-5 w-5 text-indigo-500" />
                        <span className="font-semibold">Live Editor</span>
                    </div>

                    <div className="h-6 w-px bg-[var(--border)]" />

                    <div id="live-editor-examples" className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Example:</span>
                        <select
                            className="h-8 rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            onChange={(e) => handleExampleSelect(e.target.value)}
                            defaultValue="Flowchart"
                        >
                            {Object.keys(MERMAID_EXAMPLES).map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>

                    <div id="live-editor-autosync" className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSync}
                                onChange={(e) => setAutoSync(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Auto Sync
                        </label>

                        {!autoSync && (
                            <button
                                onClick={handleManualSync}
                                className="flex items-center gap-1 rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 transition"
                            >
                                <RefreshCcw className="h-3 w-3" />
                                Sync
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* ... existing styling controls ... */}
                    <div className="flex items-center gap-1 mr-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
                        <button
                            onClick={() => setLook(prev => prev === "classic" ? "handDrawn" : "classic")}
                            className={cn(
                                "flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition",
                                look === "handDrawn"
                                    ? "bg-indigo-500 text-white"
                                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                            title="Toggle Hand-drawn look"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Hand-drawn
                        </button>
                        <div className="h-4 w-px bg-[var(--border)]" />

                        <div className="relative">
                            <button
                                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                                className="flex px-2 py-1 items-center gap-1.5 rounded text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
                                title="Select Theme"
                            >
                                <Palette className="h-3.5 w-3.5" />
                                <span className="capitalize">{diagramTheme === 'default' ? 'Theme' : diagramTheme}</span>
                            </button>
                            {themeMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-48 flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl z-50 max-h-64 overflow-y-auto">
                                    <div className="px-2 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Theme</div>
                                    {Object.keys(DIAGRAM_THEMES).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setDiagramTheme(t as DiagramTheme);
                                                setThemeMenuOpen(false);
                                            }}
                                            className={cn(
                                                "w-full rounded px-2 py-1.5 text-left text-xs capitalize transition-colors hover:bg-[var(--secondary)] flex items-center gap-2",
                                                diagramTheme === t ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium" : "text-[var(--muted-foreground)]"
                                            )}
                                        >
                                            <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: DIAGRAM_THEMES[t as DiagramTheme].themeVariables?.primaryColor }}></span>
                                            {t}
                                        </button>
                                    ))}
                                    <div className="my-1 h-px bg-[var(--border)]" />
                                    <div className="px-2 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Font</div>
                                    {["Inter, sans-serif", "Roboto, sans-serif", "Courier New, monospace", "Georgia, serif", "Comic Sans MS, cursive"].map((font) => (
                                        <button
                                            key={font}
                                            onClick={() => {
                                                setDiagramFont(font);
                                                setThemeMenuOpen(false);
                                            }}
                                            className={cn(
                                                "w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--secondary)]",
                                                diagramFont === font ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium" : "text-[var(--muted-foreground)]"
                                            )}
                                            style={{ fontFamily: font }}
                                        >
                                            {font.split(',')[0]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Color Legend Bar */}
                        <div className="ml-2 flex h-4 items-center gap-0.5 rounded border border-[var(--border)] p-0.5" title="Theme Colors">
                            {[
                                DIAGRAM_THEMES[diagramTheme]?.themeVariables?.primaryColor,
                                DIAGRAM_THEMES[diagramTheme]?.themeVariables?.secondaryColor,
                                DIAGRAM_THEMES[diagramTheme]?.themeVariables?.tertiaryColor
                            ].filter(Boolean).map((color, i) => (
                                <div key={i} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                            ))}
                        </div>

                        <div className="h-4 w-px bg-[var(--border)]" />
                        <button
                            onClick={() => setIs3D(prev => !prev)}
                            className={cn(
                                "flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition",
                                is3D
                                    ? "bg-indigo-500 text-white"
                                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                            title="Toggle 3D Effect"
                        >
                            <FolderOpen className="h-3.5 w-3.5" />
                            3D
                        </button>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                        title="Toggle Theme"
                    >
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>

                    <button
                        onClick={handleCopyCode}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                        title="Copy Code"
                    >
                        {copying ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>

                    <DiagramDownloadMenu
                        containerRef={previewRef}
                        diagramType="flowchart"
                        nodes={[]}
                        edges={[]}
                        diagramCode={debouncedCode}
                        onPrepareExport={async (fn) => await fn()}
                        userPlan={user?.plan}
                    />
                </div>
            </div>

            {/* Main Split Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Editor Pane */}
                <div id="live-editor-input" className="flex w-1/3 min-w-[300px] max-w-[50%] flex-col border-r border-[var(--border)] bg-[var(--card)]">
                    <div className="flex h-8 items-center bg-[var(--secondary)] px-4 text-xs font-medium text-[var(--muted-foreground)] border-b border-[var(--border)]">
                        MERMAID CODE
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        {/* Syntax highlighted overlay */}
                        <div className="absolute inset-0 p-4 font-mono text-sm leading-relaxed pointer-events-none overflow-auto" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                            {tokenizeMermaidCode(code).map((token, i) => (
                                <span
                                    key={i}
                                    style={{
                                        color: theme === 'dark' ? SYNTAX_COLORS[token.type].dark : SYNTAX_COLORS[token.type].light,
                                        fontWeight: token.type === 'keyword' ? 'bold' : 'normal',
                                    }}
                                >
                                    {token.text}
                                </span>
                            ))}
                        </div>
                        {/* Actual textarea (transparent text) */}
                        <textarea
                            ref={editorRef}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="absolute inset-0 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed focus:outline-none caret-[var(--foreground)]"
                            style={{ color: 'transparent', caretColor: 'var(--foreground)' }}
                            spellCheck={false}
                            placeholder="Enter Mermaid code here..."
                        />
                    </div>
                </div>

                {/* Preview Pane */}
                <div id="live-editor-preview" className="flex flex-1 flex-col bg-[var(--background)] relative">
                    <div className="flex h-8 items-center justify-between bg-[var(--secondary)] px-4 text-xs font-medium text-[var(--muted-foreground)] border-b border-[var(--border)]">
                        <span>PREVIEW</span>
                        {code !== debouncedCode && autoSync && (
                            <span className="flex items-center gap-1 text-amber-500">
                                <RefreshCcw className="h-3 w-3 animate-spin" />
                                Syncing...
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden bg-[var(--canvas)] p-0 relative" ref={previewRef}>
                        <MermaidDiagram
                            code={debouncedCode}
                            className="h-full w-full"
                            is3D={is3D}
                            look={look}
                            diagramTheme={diagramTheme}
                            fontFamily={diagramFont}
                        />
                        <DiagramZoomControls containerRef={previewRef} visible={!!debouncedCode?.trim()} />
                    </div>
                </div>
            </div>
        </div>
    );
}
