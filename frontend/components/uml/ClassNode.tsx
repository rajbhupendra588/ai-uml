"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface ClassNodeProps {
  data: { label: string; attributes?: string; methods?: string };
  selected?: boolean;
}

/** UML class box: fixed width, three compartments (name | attributes | methods), clear notation. */
const ClassNode = ({ data, selected }: ClassNodeProps) => (
  <div
    className={cn(
      "w-[240px] max-w-[240px] rounded border-2 border-violet-500/70 bg-slate-800/98 font-mono text-xs shadow-lg",
      selected && "ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-950"
    )}
  >
    <div className="border-b border-violet-500/50 bg-violet-500/25 px-2.5 py-1.5 font-semibold text-violet-200 text-center truncate" title={data.label}>
      {data.label}
    </div>
    {data.attributes && (
      <div className="border-b border-slate-600/70 px-2.5 py-1 text-slate-400 whitespace-pre-wrap break-words overflow-hidden max-h-[80px] overflow-y-auto">
        {data.attributes}
      </div>
    )}
    {data.methods && (
      <div className="px-2.5 py-1 text-slate-300 whitespace-pre-wrap break-words overflow-hidden max-h-[80px] overflow-y-auto">
        {data.methods}
      </div>
    )}
    <Handle type="target" position={Position.Top} className="!-top-1.5 !h-2.5 !w-2.5 !border-2 !border-slate-500 !bg-slate-700" />
    <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !h-2.5 !w-2.5 !border-2 !border-slate-500 !bg-slate-700" />
  </div>
);

export default memo(ClassNode);
