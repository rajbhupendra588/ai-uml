"use client";

import { cn } from "@/lib/utils";
import type { DiagramType } from "@/lib/api";
import { DIAGRAM_TYPE_LABELS } from "@/lib/api";

interface DiagramTypeSelectorProps {
  value: DiagramType;
  onChange: (type: DiagramType) => void;
  disabled?: boolean;
  className?: string;
}

const TYPES: DiagramType[] = [
  "architecture",
  "hld",
  "class",
  "sequence",
  "usecase",
  "activity",
  "state",
  "component",
  "deployment",
];

export function DiagramTypeSelector({
  value,
  onChange,
  disabled,
  className,
}: DiagramTypeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DiagramType)}
      disabled={disabled}
      className={cn(
        "rounded border px-2.5 py-1.5 text-xs font-medium outline-none transition-colors duration-300",
        "border-[var(--border)] bg-[var(--input)] text-[var(--foreground)]",
        "focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--ring)]",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      aria-label="Diagram type"
    >
      {TYPES.map((type) => (
        <option key={type} value={type}>
          {DIAGRAM_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}
