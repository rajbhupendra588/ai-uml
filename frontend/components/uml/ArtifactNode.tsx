"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtifactNodeProps {
  data: { label: string; nodeId?: string; description?: string };
  selected?: boolean;
}

const ArtifactNode = ({ data, selected }: ArtifactNodeProps) => {
  const description = data.description?.trim();
  return (
    <div
      className={cn(
        "flex min-w-[120px] max-w-[180px] flex-col gap-0.5 rounded-lg border-2 border-dashed border-amber-600/50 bg-slate-800/90 px-3 py-2",
        selected && "ring-2 ring-amber-400/50 ring-offset-2 ring-offset-slate-950"
      )}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-amber-500/80" />
        <span className="truncate text-xs font-semibold text-amber-200/90">{data.label}</span>
      </div>
      {description && (
        <p className="line-clamp-2 text-[10px] leading-snug text-slate-400" title={description}>
          {description}
        </p>
      )}
      <Handle type="target" position={Position.Top} className="!-top-1 !h-2 !w-2 !border-2 !border-amber-500/50 !bg-slate-700" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1 !h-2 !w-2 !border-2 !border-amber-500/50 !bg-slate-700" />
    </div>
  );
};

export default memo(ArtifactNode);
