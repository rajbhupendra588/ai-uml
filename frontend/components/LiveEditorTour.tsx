"use client";

import { Tour } from "./Tour";
import { type DriveStep } from "driver.js";

const STEPS: DriveStep[] = [
    {
        element: "#live-editor-examples",
        popover: {
            title: "Examples",
            description: "Start quickly with one of our pre-built examples.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#live-editor-autosync",
        popover: {
            title: "Auto Sync",
            description: "Changes update the diagram automatically. You can toggle this off for large diagrams.",
            side: "bottom",
            align: "end",
        },
    },
    {
        element: "#live-editor-input",
        popover: {
            title: "Code Editor",
            description: "Edit the Mermaid code here directly. The preview updates as you type.",
            side: "right",
            align: "start",
        },
    },
    {
        element: "#live-editor-preview",
        popover: {
            title: "Preview",
            description: "See your diagram render in real-time.",
            side: "left",
            align: "center",
        },
    },
];

export function LiveEditorTour() {
    return <Tour steps={STEPS} tourKey="has_seen_live_editor_tour" />;
}
