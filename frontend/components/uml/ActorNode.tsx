"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActorNodeProps {
  data: { label: string };
  selected?: boolean;
}

const ActorNode = ({ data, selected }: ActorNodeProps) => (
  <div className={cn("flex flex-col items-center gap-1", selected && "ring-2 ring-amber-400 rounded-full ring-offset-2 ring-offset-slate-950")}>
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-500/60 bg-slate-800 text-amber-400">
      <User className="h-5 w-5" />
    </div>
    <span className="text-xs font-medium text-slate-300">{data.label}</span>
    <Handle type="target" position={Position.Top} className="!-top-1 !h-2 !w-2 !border-2 !border-amber-500 !bg-slate-700" />
    <Handle type="source" position={Position.Bottom} className="!-bottom-1 !h-2 !w-2 !border-2 !border-amber-500 !bg-slate-700" />
  </div>
);

export default memo(ActorNode);
