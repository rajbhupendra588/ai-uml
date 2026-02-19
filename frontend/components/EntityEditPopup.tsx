"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Palette, Tag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sanitizeMermaidLabel } from "@/lib/sanitizeMermaid";
import { MAX_LABEL_LENGTH } from "@/lib/updateMermaidNode";

export interface EntityEditPopupProps {
  position: { x: number; y: number };
  entityId: string;
  label: string;
  styles?: {
    fontFamily?: string;
    fontSize?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
  };
  onSave: (
    entityId: string,
    updates: {
      label?: string;
      fontFamily?: string;
      fontSize?: string;
      fill?: string;
      stroke?: string;
    }
  ) => void;
  onCancel: () => void;
}

const FONT_FAMILIES = [
  "Inter, sans-serif",
  "Roboto, sans-serif",
  "Arial, sans-serif",
  "Courier New, monospace",
  "Georgia, serif",
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"];

const POPUP_WIDTH = 340;
const POPUP_MAX_HEIGHT = 420;
const PADDING = 12;

export function EntityEditPopup({
  position,
  entityId,
  label,
  styles = {},
  onSave,
  onCancel,
}: EntityEditPopupProps) {
  const [editedLabel, setEditedLabel] = useState(label);
  const [fontFamily, setFontFamily] = useState(styles.fontFamily ?? "Inter, sans-serif");
  const [fontSize, setFontSize] = useState(styles.fontSize ?? "14px");
  const [fillColor, setFillColor] = useState(styles.fill ?? "#e0e7ff");
  const [strokeColor, setStrokeColor] = useState(styles.stroke ?? "#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedLabel(label);
    setError(null);
  }, [entityId, label]);

  useEffect(() => {
    let left = position.x - POPUP_WIDTH / 2;
    let top = position.y - POPUP_MAX_HEIGHT - 16;

    if (left < PADDING) left = PADDING;
    if (left + POPUP_WIDTH > window.innerWidth - PADDING) {
      left = window.innerWidth - POPUP_WIDTH - PADDING;
    }
    if (top < PADDING) {
      top = position.y + 16;
    }
    if (top + POPUP_MAX_HEIGHT > window.innerHeight - PADDING) {
      top = Math.max(PADDING, window.innerHeight - POPUP_MAX_HEIGHT - PADDING);
    }

    setPopupStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${Math.min(POPUP_MAX_HEIGHT, window.innerHeight - 2 * PADDING)}px`,
      width: `${POPUP_WIDTH}px`,
      zIndex: 1000,
    });
  }, [position]);

  useEffect(() => {
    firstFocusRef.current?.focus({ preventScroll: true });
  }, []);

  const safePreview = sanitizeMermaidLabel(editedLabel.trim() || " ");
  const labelError =
    editedLabel.trim().length === 0
      ? "Label is required"
      : editedLabel.length > MAX_LABEL_LENGTH
        ? `Max ${MAX_LABEL_LENGTH} characters`
        : null;

  const handleSave = useCallback(() => {
    setError(null);
    if (editedLabel.trim().length === 0) {
      setError("Label is required");
      return;
    }
    if (editedLabel.length > MAX_LABEL_LENGTH) {
      setError(`Label must be ${MAX_LABEL_LENGTH} characters or less`);
      return;
    }
    setSaving(true);
    try {
      onSave(entityId, {
        label: editedLabel.trim(),
        fontFamily,
        fontSize,
        fill: fillColor,
        stroke: strokeColor,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [editedLabel, fontFamily, fontSize, fillColor, strokeColor, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }
    },
    [onCancel, handleSave]
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-[1px]"
        onClick={onCancel}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        aria-hidden
      />
      <div
        ref={containerRef}
        style={popupStyle}
        className={cn(
          "flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-entity-title"
        aria-describedby="edit-entity-desc"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2
            id="edit-entity-title"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
          >
            <Tag className="h-4 w-4 text-[var(--primary)]" aria-hidden />
            Edit node
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            className="rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div
          id="edit-entity-desc"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        >
          {error && (
            <div
              className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="edit-entity-id"
              className="text-xs font-medium text-[var(--muted-foreground)]"
            >
              Node ID
            </label>
            <Input
              id="edit-entity-id"
              type="text"
              value={entityId}
              readOnly
              className="cursor-not-allowed bg-[var(--secondary)] text-[var(--muted-foreground)]"
              aria-readonly="true"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-entity-label"
              className="text-xs font-medium text-[var(--muted-foreground)]"
            >
              Label <span className="text-red-500">*</span>
            </label>
            <Input
              ref={firstFocusRef}
              id="edit-entity-label"
              type="text"
              value={editedLabel}
              onChange={(e) => {
                setEditedLabel(e.target.value);
                setError(null);
              }}
              placeholder="Node label"
              maxLength={MAX_LABEL_LENGTH + 50}
              className={cn(
                labelError && "border-red-500/60 focus-visible:ring-red-500/40"
              )}
              aria-required="true"
              aria-invalid={!!labelError}
              aria-describedby={labelError ? "edit-label-error" : undefined}
            />
            {labelError && (
              <p id="edit-label-error" className="text-xs text-red-500">
                {labelError}
              </p>
            )}
            <p className="text-xs text-[var(--muted-foreground)]">
              {editedLabel.length} / {MAX_LABEL_LENGTH} · Saved as: “
              {safePreview.slice(0, 40)}
              {safePreview.length > 40 ? "…" : ""}”
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <Palette className="h-3.5 w-3.5" />
              Appearance
            </p>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-font-family"
                  className="text-xs text-[var(--muted-foreground)]"
                >
                  Font
                </label>
                <select
                  id="edit-font-family"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className={cn(
                    "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm",
                    "text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50"
                  )}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font.split(",")[0]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-font-size"
                  className="text-xs text-[var(--muted-foreground)]"
                >
                  Size
                </label>
                <select
                  id="edit-font-size"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className={cn(
                    "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm",
                    "text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50"
                  )}
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-fill"
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    Fill
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="edit-fill"
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                      aria-label="Fill color"
                    />
                    <Input
                      type="text"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#e0e7ff"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-stroke"
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    Border
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="edit-stroke"
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                      aria-label="Border color"
                    />
                    <Input
                      type="text"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: ensure above scroll area and clicks reach buttons */}
        <div className="relative z-10 flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving}
            aria-invalid={!!labelError}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
