"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";
import type { ViewMode } from "./AppHeader";

interface CompleteTourProps {
    setViewMode: (mode: ViewMode) => void;
    startTour?: boolean;
    onTourEnd?: () => void;
}

const TOUR_KEY = "has_seen_complete_tour";

export function CompleteTour({ setViewMode, startTour, onTourEnd }: CompleteTourProps) {
    const driverRef = useRef<ReturnType<typeof driver> | null>(null);

    const runTour = useCallback(() => {
        // Step definitions with view switching hooks
        const steps: DriveStep[] = [
            // Welcome
            {
                popover: {
                    title: "👋 Welcome to ArchitectAI!",
                    description: "Let me show you around. This quick tour will help you understand all the features.",
                    side: "over",
                    align: "center",
                },
            },
            // Generate View - Navigation
            {
                element: "#nav-generate",
                popover: {
                    title: "Generate View",
                    description: "This is where you create diagrams using AI. It's selected by default.",
                    side: "bottom",
                    align: "start",
                },
            },
            {
                element: "#nav-code-to-diagram",
                popover: {
                    title: "Code to Diagram",
                    description: "Convert your source code into visual diagrams automatically.",
                    side: "bottom",
                    align: "start",
                },
            },
            {
                element: "#nav-editor",
                popover: {
                    title: "Live Editor",
                    description: "Manually edit Mermaid code with real-time preview.",
                    side: "bottom",
                    align: "start",
                },
            },
            // Generate View - Features
            {
                element: "#ai-input-area",
                popover: {
                    title: "AI Chat",
                    description: "Describe what you want to create. You can paste a GitHub repo URL or describe your system architecture.",
                    side: "left",
                    align: "center",
                },
            },
            {
                element: "#canvas-area",
                popover: {
                    title: "Canvas",
                    description: "Your generated diagrams appear here. You can zoom, pan, and interact with them.",
                    side: "top",
                    align: "center",
                },
            },
            // Switch to Editor
            {
                element: "#nav-editor",
                popover: {
                    title: "Let's explore the Editor",
                    description: "Click Next to see the Live Editor view.",
                    side: "bottom",
                    align: "start",
                },
            },
            // Editor View Features
            {
                element: "#live-editor-examples",
                popover: {
                    title: "Example Templates",
                    description: "Choose from pre-built examples to get started quickly.",
                    side: "bottom",
                    align: "start",
                },
            },
            {
                element: "#live-editor-autosync",
                popover: {
                    title: "Auto Sync",
                    description: "Toggle automatic preview updates. Disable for large diagrams to improve performance.",
                    side: "bottom",
                    align: "end",
                },
            },
            {
                element: "#live-editor-input",
                popover: {
                    title: "Code Editor",
                    description: "Write or paste Mermaid syntax here. The preview updates as you type.",
                    side: "right",
                    align: "start",
                },
            },
            {
                element: "#live-editor-preview",
                popover: {
                    title: "Live Preview",
                    description: "See your diagram rendered in real-time.",
                    side: "left",
                    align: "center",
                },
            },
            // Switch to Code to Diagram
            {
                element: "#nav-code-to-diagram",
                popover: {
                    title: "Now let's check Code to Diagram",
                    description: "Click Next to explore the Code to Diagram feature.",
                    side: "bottom",
                    align: "start",
                },
            },
            // Code to Diagram Features
            {
                element: "#c2d-templates",
                popover: {
                    title: "Quick Templates",
                    description: "Load sample code patterns to see how the feature works.",
                    side: "bottom",
                    align: "start",
                },
            },
            {
                element: "#c2d-code-input",
                popover: {
                    title: "Source Code",
                    description: "Paste your code here (Python, JavaScript, TypeScript, etc.). You can also drag and drop files!",
                    side: "right",
                    align: "start",
                },
            },
            {
                element: "#c2d-prompt-input",
                popover: {
                    title: "Description",
                    description: "Tell the AI what kind of diagram you want (flowchart, class diagram, sequence diagram, etc.).",
                    side: "top",
                    align: "start",
                },
            },
            {
                element: "#c2d-generate-btn",
                popover: {
                    title: "Generate",
                    description: "Click to analyze your code and create the diagram.",
                    side: "top",
                    align: "end",
                },
            },
            {
                element: "#c2d-diagram-area",
                popover: {
                    title: "Diagram Result",
                    description: "Your generated diagram appears here. You can click on nodes to select and update specific parts.",
                    side: "left",
                    align: "center",
                },
            },
            // Completion
            {
                element: "#start-tour-btn",
                popover: {
                    title: "🎉 You're all set!",
                    description: "Start creating diagrams! You can restart this tour anytime by clicking here.",
                    side: "bottom",
                    align: "end",
                },
            },
        ];

        const config: Config = {
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: "Get Started!",
            nextBtnText: "Next →",
            prevBtnText: "← Back",
            steps,
            onNextClick: (element, step, options) => {
                const stepIndex = options.state.activeIndex ?? 0;

                // Switch to Editor before step 7 (index 7)
                if (stepIndex === 6) {
                    setViewMode("editor");
                    setTimeout(() => driverRef.current?.moveNext(), 300);
                    return;
                }

                // Switch to Code to Diagram before step 12 (index 12)
                if (stepIndex === 11) {
                    setViewMode("codeToDiagram");
                    setTimeout(() => driverRef.current?.moveNext(), 300);
                    return;
                }

                // Switch back to Generate at the end
                if (stepIndex === steps.length - 2) {
                    setViewMode("generate");
                    setTimeout(() => driverRef.current?.moveNext(), 300);
                    return;
                }

                driverRef.current?.moveNext();
            },
            onPrevClick: (element, step, options) => {
                const stepIndex = options.state.activeIndex ?? 0;

                // Switch back to Generate from Editor
                if (stepIndex === 7) {
                    setViewMode("generate");
                    setTimeout(() => driverRef.current?.movePrevious(), 300);
                    return;
                }

                // Switch back to Editor from Code to Diagram
                if (stepIndex === 12) {
                    setViewMode("editor");
                    setTimeout(() => driverRef.current?.movePrevious(), 300);
                    return;
                }

                driverRef.current?.movePrevious();
            },
            onDestroyed: () => {
                localStorage.setItem(TOUR_KEY, "true");
                setViewMode("generate");
                onTourEnd?.();
            },
        };

        driverRef.current = driver(config);

        // Ensure we're on Generate view before starting
        setViewMode("generate");
        setTimeout(() => driverRef.current?.drive(), 500);
    }, [setViewMode, onTourEnd]);

    useEffect(() => {
        // Check if tour should run automatically (first visit)
        const hasSeenTour = localStorage.getItem(TOUR_KEY);
        if (!hasSeenTour) {
            const timer = setTimeout(runTour, 1500);
            return () => clearTimeout(timer);
        }
    }, [runTour]);

    useEffect(() => {
        // Manual trigger via startTour prop
        if (startTour) {
            runTour();
        }
    }, [startTour, runTour]);

    return null;
}

// Export a function to manually start the tour
export function resetTour() {
    localStorage.removeItem(TOUR_KEY);
}
