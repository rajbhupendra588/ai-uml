"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface UseCaseNodeProps {
  data: { label: string };
  selected?: boolean;
}

const UseCaseNode = ({ data, selected }: UseCaseNodeProps) => (
  <div
    className={cn(
      "relative flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border-2 border-emerald-500/60 bg-slate-800/95 px-4 py-2 text-center text-sm font-medium text-emerald-200",
      selected && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950"
    )}
  >
    {data.label}
    <Handle type="target" position={Position.Top} className="!-top-1.5 !h-2 !w-2 !border-2 !border-emerald-500 !bg-slate-700" />
    <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !h-2 !w-2 !border-2 !border-emerald-500 !bg-slate-700" />
  </div>
);

export default memo(UseCaseNode);
