"use client";

import React, { useState, useEffect } from "react";
import { X, Type, Palette, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntityEditPopupProps {
    /** Position to display the popup */
    position: { x: number; y: number };
    /** Entity ID being edited */
    entityId: string;
    /** Current entity label/text */
    label: string;
    /** Current styles applied to the entity */
    styles?: {
        fontFamily?: string;
        fontSize?: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: string;
    };
    /** Callback when user saves changes */
    onSave: (entityId: string, updates: {
        label?: string;
        fontFamily?: string;
        fontSize?: string;
        fill?: string;
        stroke?: string;
    }) => void;
    /** Callback when user cancels */
    onCancel: () => void;
}

const FONT_FAMILIES = [
    "Inter, sans-serif",
    "Roboto, sans-serif",
    "Arial, sans-serif",
    "Courier New, monospace",
    "Georgia, serif",
    "Comic Sans MS, cursive",
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px"];

export function EntityEditPopup({
    position,
    entityId,
    label,
    styles = {},
    onSave,
    onCancel,
}: EntityEditPopupProps) {
    const [editedLabel, setEditedLabel] = useState(label);
    const [fontFamily, setFontFamily] = useState(styles.fontFamily || "Inter, sans-serif");
    const [fontSize, setFontSize] = useState(styles.fontSize || "14px");
    const [fillColor, setFillColor] = useState(styles.fill || "#e0e7ff");
    const [strokeColor, setStrokeColor] = useState(styles.stroke || "#6366f1");

    // Position popup above the entity, adjusting if near screen edges
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        const popupWidth = 320;
        const padding = 12;
        const maxHeight = Math.min(420, window.innerHeight - padding * 2);

        let left = position.x - popupWidth / 2;
        let top = position.y - maxHeight - 20; // Prefer above the entity

        // Horizontal clamp
        if (left < padding) left = padding;
        if (left + popupWidth > window.innerWidth - padding) {
            left = window.innerWidth - popupWidth - padding;
        }
        // Vertical clamp so popup stays inside window
        if (top < padding) {
            top = position.y + 20; // Show below entity
        }
        if (top + maxHeight > window.innerHeight - padding) {
            top = window.innerHeight - maxHeight - padding;
        }
        if (top < padding) {
            top = padding;
        }

        setPopupStyle({
            position: "fixed",
            left: `${left}px`,
            top: `${top}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: 1000,
        });
    }, [position]);

    const handleSave = () => {
        onSave(entityId, {
            label: editedLabel,
            fontFamily,
            fontSize,
            fill: fillColor,
            stroke: strokeColor,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            onCancel();
        } else if (e.key === "Enter" && e.ctrlKey) {
            handleSave();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 z-[999]"
                onClick={onCancel}
                aria-hidden="true"
            />

            {/* Popup */}
            <div
                style={popupStyle}
                className="w-80 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onKeyDown={handleKeyDown}
                role="dialog"
                aria-label="Edit Entity"
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            Edit Entity
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content - scrollable, flex-1 so footer stays at bottom */}
                <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto">
                    {/* Entity ID (read-only) */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <AlignLeft className="h-3 w-3" />
                            Entity ID
                        </label>
                        <input
                            type="text"
                            value={entityId}
                            readOnly
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] cursor-not-allowed"
                        />
                    </div>

                    {/* Label */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <AlignLeft className="h-3 w-3" />
                            Label
                        </label>
                        <input
                            type="text"
                            value={editedLabel}
                            onChange={(e) => setEditedLabel(e.target.value)}
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Enter label"
                            autoFocus
                        />
                    </div>

                    {/* Font Family */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <Type className="h-3 w-3" />
                            Font Family
                        </label>
                        <select
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {FONT_FAMILIES.map((font) => (
                                <option key={font} value={font} style={{ fontFamily: font }}>
                                    {font.split(",")[0]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Font Size */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <Type className="h-3 w-3" />
                            Font Size
                        </label>
                        <select
                            value={fontSize}
                            onChange={(e) => setFontSize(e.target.value)}
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {FONT_SIZES.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fill Color */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <Palette className="h-3 w-3" />
                            Fill Color
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={fillColor}
                                onChange={(e) => setFillColor(e.target.value)}
                                className="h-9 w-16 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                            />
                            <input
                                type="text"
                                value={fillColor}
                                onChange={(e) => setFillColor(e.target.value)}
                                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="#e0e7ff"
                            />
                        </div>
                    </div>

                    {/* Stroke/Border Color */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            <Palette className="h-3 w-3" />
                            Border Color
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={strokeColor}
                                onChange={(e) => setStrokeColor(e.target.value)}
                                className="h-9 w-16 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                            />
                            <input
                                type="text"
                                value={strokeColor}
                                onChange={(e) => setStrokeColor(e.target.value)}
                                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="#6366f1"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                    <button
                        onClick={onCancel}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
                        title="Save (Ctrl+Enter)"
                    >
                        Save
                    </button>
                </div>
            </div>
        </>
    );
}
