"use client";

import { Tour } from "./Tour";
import { type DriveStep } from "driver.js";

const STEPS: DriveStep[] = [
    {
        element: "#nav-generate",
        popover: {
            title: "Generate Diagrams",
            description: "Start here to create new diagrams using AI. Just describe what you want!",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#nav-code-to-diagram",
        popover: {
            title: "Code to Diagram",
            description: "Have existing code? Paste it here to automatically generate a diagram from it.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#nav-editor",
        popover: {
            title: "Editor",
            description: "Switch to the editor view to fine-tune the Mermaid code directly.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#ai-input-area",
        popover: {
            title: "AI Chat",
            description: "Chat with the AI here. Describe your system, ask for changes, or paste a repo URL.",
            side: "left",
            align: "center",
        },
    },
    {
        element: "#canvas-area",
        popover: {
            title: "Canvas",
            description: "Your diagrams will appear here. You can zoom, pan, and interact with the nodes.",
            side: "top",
            align: "center",
        },
    },
];

export function OnboardingTour() {
    return <Tour steps={STEPS} tourKey="has_seen_onboarding_tour" />;
}
