"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface LifelineNodeProps {
  data: { label: string };
  selected?: boolean;
}

/**
 * UML sequence diagram participant: name box + vertical dashed lifeline (timeline).
 * Left/Right handles for horizontal message flow between participants.
 */
const LifelineNode = ({ data, selected }: LifelineNodeProps) => (
  <div
    className={cn(
      "flex flex-col items-center",
      selected && "ring-2 ring-cyan-400 rounded ring-offset-2 ring-offset-slate-950"
    )}
  >
    <div className="rounded border-2 border-cyan-500/60 bg-slate-800 px-3 py-1.5 text-sm font-medium text-cyan-200 shadow">
      {data.label}
    </div>
    <div
      className="mt-0.5 min-h-[420px] w-0.5 border-l-2 border-dashed border-cyan-500/50"
      aria-hidden
    />
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

export default memo(LifelineNode);
