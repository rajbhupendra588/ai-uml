"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface SequenceMessageNodeProps {
  data: { label: string; step?: number };
  selected?: boolean;
}

/**
 * One message in a sequence diagram: numbered step badge + short label.
 * Correct UML: step 1, 2, 3... in time order; to the point.
 */
const SequenceMessageNode = ({ data, selected }: SequenceMessageNodeProps) => {
  const step = data.step ?? 0;
  return (
    <div
      className={cn(
        "flex min-h-[40px] min-w-[100px] max-w-[200px] items-center gap-2 rounded border-2 border-cyan-500/60 bg-slate-800/95 px-2.5 py-1.5 shadow",
        selected && "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950"
      )}
    >
      <span
        className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-cyan-500/80 text-xs font-bold text-slate-900"
        aria-label={`Step ${step}`}
      >
        {step}
      </span>
      <span className="truncate text-xs font-medium text-cyan-200">{data.label}</span>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!-left-1.5 !top-1/2 !h-2 !w-2 !-translate-y-1/2 !border-2 !border-cyan-500 !bg-slate-700"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!-right-1.5 !top-1/2 !h-2 !w-2 !-translate-y-1/2 !border-2 !border-cyan-500 !bg-slate-700"
      />
    </div>
  );
};

export default memo(SequenceMessageNode);
