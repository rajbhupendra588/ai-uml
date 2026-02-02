"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComponentNodeProps {
  data: { label: string };
  selected?: boolean;
}

const ComponentNode = ({ data, selected }: ComponentNodeProps) => (
  <div className={cn("flex items-center gap-2 rounded-lg border-2 border-teal-500/60 bg-slate-800/95 px-3 py-2 shadow-lg", selected && "ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950")}>
    <Package className="h-5 w-5 shrink-0 text-teal-400" />
    <span className="text-sm font-medium text-teal-200">{data.label}</span>
    <Handle type="target" position={Position.Top} className="!-top-1.5 !h-2 !w-2 !border-2 !border-teal-500 !bg-slate-700" />
    <Handle type="source" position={Position.Bottom} className="!-bottom-1.5 !h-2 !w-2 !border-2 !border-teal-500 !bg-slate-700" />
  </div>
);

export default memo(ComponentNode);
