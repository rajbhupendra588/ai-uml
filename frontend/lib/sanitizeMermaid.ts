/**
 * Sanitize Mermaid labels and code so the parser does not hit STADIUMEND / parse errors.
 * Mermaid stadium shape is nodeId(["label"]) - the label must not contain "] or ") or ").
 */

/**
 * Sanitize a single label string (e.g. from entity edit popup) before inserting into Mermaid code.
 */
export function sanitizeMermaidLabel(label: string): string {
  if (label == null || typeof label !== "string") return "";
  let t = label
    .replace(/&/g, " and ")
    .replace(/"/g, "'")
    .replace(/\]/g, " ")
    .replace(/\[/g, " ")
    .replace(/\)/g, " ")
    .replace(/\(/g, " ")
    .replace(/\{/g, " ")
    .replace(/\}/g, " ")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || " ";
}

/**
 * Fix Mermaid code that may contain labels with "] or ") so the parser does not throw STADIUMEND.
 * 1) Remove duplicate "])" within the same node.
 * 2) Replace any double-quote with single-quote so a " inside a label never breaks the parser (Expecting STADIUMEND, got STR).
 *    Mermaid accepts single-quoted labels, so this is safe.
 */
export function sanitizeMermaidCode(code: string | null | undefined): string {
  if (code == null || typeof code !== "string") return "";
  const lines = code.split("\n");
  const out: string[] = [];
  const needle = '"])';
  const openTag = '(["';

  for (const line of lines) {
    let processed = line;
    if (line.includes(openTag) && line.includes(needle)) {
      const segments = line.split(openTag);
      const fixedSegments: string[] = [segments[0]];
      for (let s = 1; s < segments.length; s++) {
        const segment = segments[s];
        const indices: number[] = [];
        let idx = 0;
        for (;;) {
          const next = segment.indexOf(needle, idx);
          if (next === -1) break;
          indices.push(next);
          idx = next + 1;
        }
        if (indices.length <= 1) {
          fixedSegments.push(segment);
          continue;
        }
        const lastIdx = indices[indices.length - 1];
        let fixed = "";
        let start = 0;
        for (const i of indices) {
          if (i === lastIdx) break;
          fixed += segment.slice(start, i);
          start = i + needle.length;
        }
        fixed += segment.slice(lastIdx);
        fixedSegments.push(fixed);
      }
      processed = fixedSegments.join(openTag);
    }
    out.push(processed);
  }
  return out.join("\n").replace(/"/g, "'");
}
