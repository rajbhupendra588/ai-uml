"use client";

import { cn } from "@/lib/utils";
import type { ModelOption } from "@/lib/api";

interface ModelSelectorProps {
  value: string;
  options: ModelOption[];
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  value,
  options,
  onChange,
  disabled,
  className,
}: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "rounded border px-2.5 py-1.5 text-xs font-medium outline-none transition-colors duration-300",
        "border-[var(--border)] bg-[var(--input)] text-[var(--foreground)]",
        "focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--ring)]",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      aria-label="Model"
    >
      {options.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
