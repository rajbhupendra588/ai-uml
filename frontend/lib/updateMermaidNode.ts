/**
 * Production-ready Mermaid node label update.
 * Replaces a node's label in the diagram source by shape-aware patterns.
 * Uses string parsing only (no regex for shapes) to avoid "Unmatched ')'" in all engines.
 */

import { sanitizeMermaidLabel } from "./sanitizeMermaid";

export interface UpdateNodeResult {
  success: boolean;
  code: string;
  error?: string;
}

/** Max label length for diagram nodes (sanity limit). */
const MAX_LABEL_LENGTH = 200;

/** Find index of closing quote (not backslash-escaped) after start. */
function findClosingQuote(s: string, start: number, quote: '"' | "'" = '"'): number {
  for (let i = start; i < s.length; i++) {
    if (s[i] === quote && (i === 0 || s[i - 1] !== "\\")) return i;
  }
  return -1;
}

/** Check that line has nodeId as a whole word at idStart. */
function isWholeWord(line: string, idStart: number, nodeId: string): boolean {
  const before = idStart === 0 || /[\s[\]({},->]/.test(line[idStart - 1]);
  const after = idStart + nodeId.length >= line.length || /[\s[\]({},->]/.test(line[idStart + nodeId.length]);
  return before && after;
}

/** Shape templates: quote is " or ' so we match both after sanitizeMermaidCode. */
const SHAPE_TEMPLATES: Array<{ open: string; close: string }> = [
  { open: '(["', close: '"])' },
  { open: '[("', close: '"])' },
  { open: '("', close: '")' },
  { open: '(("', close: '"))' },
  { open: '["', close: '"]' },
  { open: '{"', close: '"}' },
];

function shapesForQuote(q: '"' | "'"): Array<{ open: string; close: string }> {
  return SHAPE_TEMPLATES.map(({ open, close }) => ({
    open: open.replace(/"/g, q),
    close: close.replace(/"/g, q),
  }));
}

/**
 * Update a single node's label in Mermaid flowchart/definition code.
 * Handles common shapes: ["..."], ("..."), (["..."]), (("...")), {"..."}.
 */
export function updateNodeLabel(
  code: string,
  nodeId: string,
  newLabel: string
): UpdateNodeResult {
  if (!code || typeof code !== "string") {
    return { success: false, code: code ?? "", error: "No diagram code" };
  }
  const trimmed = newLabel.trim();
  if (trimmed.length === 0) {
    return { success: false, code, error: "Label cannot be empty" };
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    return { success: false, code, error: `Label must be ${MAX_LABEL_LENGTH} characters or less` };
  }

  const safeLabel = sanitizeMermaidLabel(trimmed);
  const lines = code.split("\n");
  let replaced = false;

  // Match both " and ' shapes (diagram may be sanitized to single quotes)
  const SHAPES = [...shapesForQuote('"'), ...shapesForQuote("'")];

  const newLines = lines.map((line) => {
    let pos = 0;
    while (pos < line.length) {
      const idStart = line.indexOf(nodeId, pos);
      if (idStart === -1) break;
      if (!isWholeWord(line, idStart, nodeId)) {
        pos = idStart + 1;
        continue;
      }
      const afterId = line.slice(idStart + nodeId.length);
      const spaceMatch = afterId.match(/^(\s*)/);
      const space = spaceMatch ? spaceMatch[1] : "";
      const rest = afterId.slice(space.length);

      for (const { open, close } of SHAPES) {
        if (!rest.startsWith(open)) continue;
        const labelStart = open.length;
        const quoteChar = (open.slice(-1) === '"' ? '"' : "'") as '"' | "'";
        const quoteEnd = findClosingQuote(rest, labelStart, quoteChar);
        if (quoteEnd === -1) continue;
        const afterLabel = rest.slice(quoteEnd + 1);
        if (!afterLabel.startsWith(close.slice(1))) continue;

        const newSegment = open.slice(0, -1) + safeLabel + close;
        const restAfterClose = afterLabel.slice(close.length - 1);

        replaced = true;
        return (
          line.slice(0, idStart) +
          nodeId +
          space +
          newSegment +
          restAfterClose
        );
      }

      // Fallback: after nodeId, find first " or ' and its match, then replace the content (catches any shape we didn't list)
      const firstDq = rest.indexOf('"');
      const firstSq = rest.indexOf("'");
      const useDq = firstDq >= 0 && (firstSq < 0 || firstDq < firstSq);
      const quoteChar: '"' | "'" = useDq ? ("\"" as const) : ("'" as const);
      const labelStart = useDq ? firstDq + 1 : firstSq + 1;
      if (labelStart <= 0) {
        pos = idStart + 1;
        continue;
      }
      const quoteEnd = findClosingQuote(rest, labelStart, quoteChar);
      if (quoteEnd === -1) {
        pos = idStart + 1;
        continue;
      }
      const beforeQuote = rest.slice(0, labelStart - 1);
      const afterContent = rest.slice(quoteEnd + 1);
      const newSegment = beforeQuote + quoteChar + safeLabel + quoteChar + afterContent;
      replaced = true;
      return line.slice(0, idStart) + nodeId + space + newSegment;
    }
    return line;
  });

  if (!replaced) {
    return {
      success: false,
      code,
      error: `Could not find node "${nodeId}" in diagram`,
    };
  }

  return {
    success: true,
    code: newLines.join("\n"),
  };
}

export { MAX_LABEL_LENGTH };
