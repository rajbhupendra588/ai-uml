/**
 * Download utilities for diagram export.
 * Production-grade: consistent filenames, MIME types, and error handling.
 */

export type DiagramType =
  | "architecture"
  | "hld"
  | "class"
  | "sequence"
  | "usecase"
  | "activity"
  | "state"
  | "component"
  | "deployment";

const DATE_PART = () =>
  new Date().toISOString().slice(0, 10).replace(/-/g, "");

/**
 * Generate a consistent, readable filename for diagram exports.
 * Example: architecture-diagram-20250202.png
 */
export function getDownloadFilename(
  format: "png" | "svg" | "json" | "pdf",
  diagramType: DiagramType
): string {
  const base = `${diagramType}-diagram-${DATE_PART()}`;
  const ext = format === "png" ? "png" : format === "svg" ? "svg" : format === "pdf" ? "pdf" : "json";
  return `${base}.${ext}`;
}

/**
 * Trigger a file download from a Blob (images, PDF).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Trigger a file download from a string (JSON).
 */
export function downloadString(
  content: string,
  filename: string,
  mimeType: string = "application/json"
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
