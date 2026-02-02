"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Server, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeploymentNodeProps {
  data: { label: string; nodeType?: string; description?: string };
  selected?: boolean;
}

const DeploymentNode = ({ data, selected }: DeploymentNodeProps) => {
  const isDevice = (data.nodeType || "device").toLowerCase() === "device";
  const description = data.description?.trim();

  const styles = isDevice
    ? "border-cyan-500/70 bg-slate-800/95 text-cyan-200"
    : "border-blue-500/60 bg-slate-800/95 text-blue-200";

  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[200px] rounded-xl border-2 px-3 py-2.5",
        styles,
        selected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-cyan-400"
      )}
    >
      <div className="flex items-center gap-2">
        {isDevice ? (
          <Cloud className="h-5 w-5 shrink-0 text-cyan-400" />
        ) : (
          <Server className="h-5 w-5 shrink-0 text-blue-400" />
        )}
        <span className="truncate text-sm font-semibold">{data.label}</span>
      </div>
      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider opacity-80">
        {isDevice ? "Device" : "Service"}
      </span>
      {description && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-90" title={description}>
          {description}
        </p>
      )}
      <Handle type="target" position={Position.Left} className="!-left-1.5 !h-2 !w-2 !border-2 !border-slate-500 !bg-slate-700" />
      <Handle type="source" position={Position.Right} className="!-right-1.5 !h-2 !w-2 !border-2 !border-slate-500 !bg-slate-700" />
    </div>
  );
};

export default memo(DeploymentNode);
