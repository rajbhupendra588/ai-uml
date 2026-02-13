"use client";

import { Tour } from "./Tour";
import { type DriveStep } from "driver.js";

const STEPS: DriveStep[] = [
    {
        element: "#c2d-templates",
        popover: {
            title: "Quick Templates",
            description: "Load sample code patterns to get started.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#c2d-code-input",
        popover: {
            title: "Source Code",
            description: "Paste your existing code (Python, JS, etc.) here. You can also drag and drop files!",
            side: "right",
            align: "start",
        },
    },
    {
        element: "#c2d-prompt-input",
        popover: {
            title: "Description",
            description: "Tell the AI what kind of diagram to generate from your code.",
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
            description: "Your generated diagram will appear here.",
            side: "left",
            align: "center",
        },
    },
];

export function CodeToDiagramTour() {
    return <Tour steps={STEPS} tourKey="has_seen_c2d_tour" />;
}
