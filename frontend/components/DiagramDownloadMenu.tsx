"use client";

import React, { useCallback, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import { Download, FileImage, FileJson, FileType, ImageIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getDownloadFilename,
  downloadBlob,
  downloadString,
  type DiagramType,
} from "@/lib/download";
import { getShareUrl } from "@/lib/api";
import type { Node, Edge } from "@xyflow/react";
import { addWatermarkToImage, shouldAddWatermark } from "@/lib/watermark";

/** Free plan users can only download as PNG. */
function isFreePlan(userPlan?: string): boolean {
  return shouldAddWatermark(userPlan);
}

const IMAGE_SCALE = 2;
const IMAGE_QUALITY = 1;
const PDF_IMAGE_SCALE = 2;

export interface DiagramDownloadMenuProps {
  /** Ref to the flow container element (captured for PNG/SVG/PDF). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current diagram type (used for filename and JSON payload). */
  diagramType: DiagramType;
  /** Current nodes (for JSON export). */
  nodes: Node[];
  /** Current edges (for JSON export). */
  edges: Edge[];
  /** When set, diagram is rendered from code (abstract); JSON export includes this. */
  diagramCode?: string | null;
  /**
   * Run an async export while the UI is in "exporting" state (e.g. overlays hidden).
   * Must be called before capturing the container for image/PDF.
   */
  onPrepareExport: (exportFn: () => Promise<void>) => void;
  disabled?: boolean;
  className?: string;
  /** When set, menu open state is controlled by parent (e.g. for keyboard shortcut). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** User's plan (for watermark logic) */
  userPlan?: string;
}

export function DiagramDownloadMenu({
  containerRef,
  diagramType,
  nodes,
  edges,
  diagramCode = null,
  onPrepareExport,
  disabled,
  className,
  open: controlledOpen,
  onOpenChange: controlledSetOpen,
  userPlan,
}: DiagramDownloadMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledSetOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledSetOpen : setInternalOpen;

  const freePlan = isFreePlan(userPlan);

  const runExport = useCallback(
    async (exportFn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await onPrepareExport(exportFn);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Export failed. Please try again.";
        toast.error(message);
      } finally {
        setBusy(false);
        setOpen(false);
      }
    },
    [busy, onPrepareExport]
  );

  const handleDownloadPng = useCallback(() => {
    runExport(async () => {
      const el = containerRef.current;
      if (!el) {
        throw new Error("Canvas not ready. Please try again.");
      }
      // Small delay to ensure SVG is fully rendered
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: IMAGE_SCALE,
        quality: IMAGE_QUALITY,
        backgroundColor: "#020617",
        skipFonts: true, // Skip external fonts to avoid CORS issues
        filter: (node) => {
          if (node instanceof HTMLLinkElement && node.href?.includes('fonts.googleapis.com')) return false;
          if (node instanceof HTMLElement && node.closest?.('[data-diagram-download-hide]')) return false;
          return true;
        },
      });
      const res = await fetch(dataUrl);
      let blob = await res.blob();

      // Add watermark for free tier users
      if (shouldAddWatermark(userPlan)) {
        blob = await addWatermarkToImage(blob);
        toast.success("Diagram downloaded as PNG (with watermark)");
      } else {
        toast.success("Diagram downloaded as PNG");
      }

      downloadBlob(blob, getDownloadFilename("png", diagramType));
    });
  }, [containerRef, diagramType, runExport, userPlan]);

  const handleDownloadSvg = useCallback(() => {
    runExport(async () => {
      const el = containerRef.current;
      if (!el) {
        throw new Error("Canvas not ready. Please try again.");
      }
      // Small delay to ensure SVG is fully rendered
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toSvg(el, {
        cacheBust: true,
        backgroundColor: "#020617",
        skipFonts: true,
        filter: (node) => {
          if (node instanceof HTMLLinkElement && node.href?.includes('fonts.googleapis.com')) return false;
          if (node instanceof HTMLElement && node.closest?.('[data-diagram-download-hide]')) return false;
          return true;
        },
      });
      const res = await fetch(dataUrl);
      let blob = await res.blob();

      // Free plan: only PNG is allowed; we don't reach here when freePlan (SVG item hidden).
      if (shouldAddWatermark(userPlan)) {
        const pngDataUrl = await toPng(el, {
          cacheBust: true,
          pixelRatio: IMAGE_SCALE,
          quality: IMAGE_QUALITY,
          backgroundColor: "#020617",
          skipFonts: true,
          filter: (node) => {
            if (node instanceof HTMLLinkElement && node.href?.includes('fonts.googleapis.com')) return false;
            if (node instanceof HTMLElement && node.closest?.('[data-diagram-download-hide]')) return false;
            return true;
          },
        });
        const res = await fetch(pngDataUrl);
        const pngBlob = await res.blob();
        blob = await addWatermarkToImage(pngBlob);
        toast.success("Diagram downloaded as PNG (with watermark)");
        downloadBlob(blob, getDownloadFilename("png", diagramType));
      } else {
        toast.success("Diagram downloaded as SVG");
        downloadBlob(blob, getDownloadFilename("svg", diagramType));
      }
    });
  }, [containerRef, diagramType, runExport, userPlan]);

  const handleDownloadPdf = useCallback(() => {
    runExport(async () => {
      const el = containerRef.current;
      if (!el) {
        throw new Error("Canvas not ready. Please try again.");
      }
      // Small delay to ensure SVG is fully rendered (important for Mermaid diagrams)
      await new Promise((r) => setTimeout(r, 100));

      let dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: PDF_IMAGE_SCALE,
        quality: IMAGE_QUALITY,
        backgroundColor: "#020617",
        skipFonts: true,
        filter: (node) => {
          if (node instanceof HTMLLinkElement && node.href?.includes('fonts.googleapis.com')) return false;
          if (node instanceof HTMLElement && node.closest?.('[data-diagram-download-hide]')) return false;
          return true;
        },
      });

      // Add watermark for free tier users
      if (shouldAddWatermark(userPlan)) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const watermarkedBlob = await addWatermarkToImage(blob);
        // Convert watermarked blob back to data URL
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read watermarked image"));
          reader.readAsDataURL(watermarkedBlob);
        });
      }

      const img = document.createElement("img");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image for PDF"));
        img.src = dataUrl;
      });
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Ensure minimum dimensions
      if (w < 10 || h < 10) {
        throw new Error("Diagram appears empty. Please ensure the diagram is fully rendered.");
      }

      const pdf = new jsPDF({
        orientation: w > h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
      pdf.save(getDownloadFilename("pdf", diagramType));

      if (shouldAddWatermark(userPlan)) {
        toast.success("Diagram downloaded as PDF (with watermark)");
      } else {
        toast.success("Diagram downloaded as PDF");
      }
    });
  }, [containerRef, diagramType, runExport, userPlan]);

  const handleShareLink = useCallback(async () => {
    if (!diagramCode || busy) return;
    setBusy(true);
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(getShareUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mermaid_code: diagramCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Share failed");
      const shareUrl = data.share_url || `${baseUrl}/share/${data.share_id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Share failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [diagramCode, busy]);

  const handleDownloadJson = useCallback(() => {
    if (busy) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        diagramType,
        exportedAt: new Date().toISOString(),
      };
      if (diagramCode) {
        payload.code = diagramCode;
      } else {
        payload.nodes = nodes;
        payload.edges = edges;
      }
      const content = JSON.stringify(payload, null, 2);
      downloadString(
        content,
        getDownloadFilename("json", diagramType),
        "application/json"
      );
      toast.success("Diagram downloaded as JSON");
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Export failed. Please try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [busy, diagramType, nodes, edges, diagramCode]);

  return (
    <div className={cn("flex gap-2", className)} data-diagram-download-hide>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={disabled || busy}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:pointer-events-none transition"
            aria-label="Download diagram"
            title="Download"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[12rem] rounded-lg border border-slate-700/80 bg-slate-800/95 p-1 shadow-xl"
            sideOffset={6}
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-slate-500">
              Export as
            </DropdownMenu.Label>
            <DropdownMenu.Item
              onSelect={handleDownloadPng}
              disabled={busy}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-slate-700/80 hover:text-slate-100 focus:bg-slate-700/80 focus:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <FileImage className="size-4 shrink-0 text-slate-400" />
              PNG image
            </DropdownMenu.Item>
            {!freePlan && (
              <>
                <DropdownMenu.Item
                  onSelect={handleDownloadSvg}
                  disabled={busy}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-slate-700/80 hover:text-slate-100 focus:bg-slate-700/80 focus:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <ImageIcon className="size-4 shrink-0 text-slate-400" />
                  SVG image
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={handleDownloadPdf}
                  disabled={busy}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-slate-700/80 hover:text-slate-100 focus:bg-slate-700/80 focus:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <FileType className="size-4 shrink-0 text-slate-400" />
                  PDF document
                </DropdownMenu.Item>
              </>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-slate-600/80" />
            {diagramCode && (
              <DropdownMenu.Item
                onSelect={handleShareLink}
                disabled={busy}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-slate-700/80 hover:text-slate-100 focus:bg-slate-700/80 focus:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <Link2 className="size-4 shrink-0 text-slate-400" />
                Share link
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              onSelect={handleDownloadJson}
              disabled={busy}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-slate-700/80 hover:text-slate-100 focus:bg-slate-700/80 focus:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <FileJson className="size-4 shrink-0 text-slate-400" />
              JSON data
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
