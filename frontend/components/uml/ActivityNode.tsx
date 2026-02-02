"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface ActivityNodeProps {
  data: { label: string; nodeType?: string };
  selected?: boolean;
}

const ActivityNode = ({ data, selected }: ActivityNodeProps) => {
  const type = (data.nodeType || "activity").toLowerCase();
  const isStart = type === "start";
  const isEnd = type === "end";
  const isDecision = type === "decision";

  if (isStart)
    return (
      <div className={cn("flex flex-col items-center", selected && "ring-2 ring-green-400 rounded-full ring-offset-2 ring-offset-slate-950")}>
        <div className="h-6 w-6 rounded-full border-2 border-green-500 bg-slate-800" />
        <span className="mt-1 text-xs text-slate-400">{data.label}</span>
        <Handle type="source" position={Position.Bottom} className="!-bottom-1 !h-2 !w-2 !border-2 !border-green-500 !bg-slate-700" />
      </div>
    );

  if (isEnd)
    return (
      <div className={cn("flex flex-col items-center", selected && "ring-2 ring-red-400 rounded-full ring-offset-2 ring-offset-slate-950")}>
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-full border-2 border-red-500 bg-slate-800" />
          <div className="absolute inset-1 rounded-full border-2 border-red-500" />
        </div>
        <span className="mt-1 text-xs text-slate-400">{data.label}</span>
        <Handle type="target" position={Position.Top} className="!-top-1 !h-2 !w-2 !border-2 !border-red-500 !bg-slate-700" />
      </div>
    );

  if (isDecision)
    return (
      <div className={cn("flex flex-col items-center", selected && "ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-950")}>
        <div className="h-10 w-10 rotate-45 border-2 border-orange-500/60 bg-slate-800" />
        <span className="mt-1 max-w-[80px] truncate text-center text-xs text-slate-400">{data.label}</span>
        <Handle type="target" position={Position.Top} className="!-top-1 !h-2 !w-2 !border-2 !border-orange-500 !bg-slate-700" />
        <Handle type="source" position={Position.Bottom} className="!-bottom-1 !h-2 !w-2 !border-2 !border-orange-500 !bg-slate-700" />
      </div>
    );

  return (
    <div className={cn("rounded-lg border-2 border-sky-500/60 bg-slate-800/95 px-3 py-2 text-sm text-sky-200", selected && "ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950")}>
      {data.label}
      <Handle type="target" position={Position.Top} className="!-top-1.5 !h-2 !w-2 !border-2 !border-sky-500 !bg-slate-700" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !h-2 !w-2 !border-2 !border-sky-500 !bg-slate-700" />
    </div>
  );
};

export default memo(ActivityNode);
