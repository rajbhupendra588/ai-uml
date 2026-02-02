"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface StateNodeProps {
  data: { label: string; isInitial?: boolean; isFinal?: boolean };
  selected?: boolean;
}

const StateNode = ({ data, selected }: StateNodeProps) => {
  const isInitial = data.isInitial;
  const isFinal = data.isFinal;

  if (isInitial)
    return (
      <div className={cn("flex flex-col items-center", selected && "ring-2 ring-green-400 rounded-full ring-offset-2 ring-offset-slate-950")}>
        <div className="h-4 w-4 rounded-full border-2 border-green-500 bg-green-500/30" />
        <span className="mt-1 text-xs text-slate-400">initial</span>
        <Handle type="source" position={Position.Bottom} className="!-bottom-1 !h-2 !w-2 !border-2 !border-green-500 !bg-slate-700" />
      </div>
    );

  if (isFinal)
    return (
      <div className={cn("flex flex-col items-center", selected && "ring-2 ring-red-400 ring-offset-2 ring-offset-slate-950")}>
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-red-500 bg-slate-800" />
          <div className="absolute inset-1.5 rounded-full border-2 border-red-500" />
        </div>
        <span className="mt-1 text-xs text-slate-400">final</span>
        <Handle type="target" position={Position.Top} className="!-top-1 !h-2 !w-2 !border-2 !border-red-500 !bg-slate-700" />
      </div>
    );

  return (
    <div className={cn("rounded-xl border-2 border-rose-500/60 bg-slate-800/95 px-4 py-2 text-sm font-medium text-rose-200", selected && "ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-950")}>
      {data.label}
      <Handle type="target" position={Position.Top} className="!-top-1.5 !h-2 !w-2 !border-2 !border-rose-500 !bg-slate-700" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !h-2 !w-2 !border-2 !border-rose-500 !bg-slate-700" />
    </div>
  );
};

export default memo(StateNode);
