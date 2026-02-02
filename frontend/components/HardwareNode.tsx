"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Database,
  Server,
  Globe,
  Shield,
  Cpu,
  Box,
  Loader2,
  Users,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NodeKind =
  | "database"
  | "server"
  | "auth"
  | "balancer"
  | "client"
  | "function"
  | "queue"
  | "shield"
  | "default";

function parseKind(subLabel?: string, label?: string): NodeKind {
  const type = (subLabel ?? label ?? "").toLowerCase();
  const name = (label ?? "").toLowerCase();
  if (type.includes("database") || type.includes("db") || name.includes("db") || name.includes("database") || name.includes("postgres") || name.includes("sql"))
    return "database";
  if (type.includes("auth") || name.includes("auth") || name.includes("identity") || name.includes("login") || name.includes("clerk"))
    return "auth";
  if (type.includes("balancer") || name.includes("load") || name.includes("balancer") || name.includes("alb"))
    return "balancer";
  if (type.includes("client") || name.includes("client") || name.includes("entry") || name.includes("traffic"))
    return "client";
  if (type.includes("function") || name.includes("lambda") || name.includes("function"))
    return "function";
  if (type.includes("queue") || name.includes("queue") || name.includes("worker") || name.includes("kafka"))
    return "queue";
  if (type.includes("shield") || name.includes("risk") || name.includes("compliance"))
    return "shield";
  if (type.includes("server") || type.includes("api") || name.includes("api") || name.includes("gateway") || name.includes("server"))
    return "server";
  return "default";
}

const KIND_STYLES: Record<
  NodeKind,
  { icon: React.ReactNode; stripe: string; border: string; iconBg: string }
> = {
  database: {
    icon: <Database className="h-5 w-5 text-emerald-400" />,
    stripe: "bg-emerald-500",
    border: "border-emerald-500/40",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
  },
  server: {
    icon: <Server className="h-5 w-5 text-blue-400" />,
    stripe: "bg-blue-500",
    border: "border-blue-500/40",
    iconBg: "bg-blue-500/20 border-blue-500/30",
  },
  auth: {
    icon: <Shield className="h-5 w-5 text-amber-400" />,
    stripe: "bg-amber-500",
    border: "border-amber-500/40",
    iconBg: "bg-amber-500/20 border-amber-500/30",
  },
  balancer: {
    icon: <Loader2 className="h-5 w-5 text-cyan-400" />,
    stripe: "bg-cyan-500",
    border: "border-cyan-500/40",
    iconBg: "bg-cyan-500/20 border-cyan-500/30",
  },
  client: {
    icon: <Users className="h-5 w-5 text-slate-300" />,
    stripe: "bg-slate-500",
    border: "border-slate-500/40",
    iconBg: "bg-slate-500/20 border-slate-500/30",
  },
  function: {
    icon: <Cpu className="h-5 w-5 text-orange-400" />,
    stripe: "bg-orange-500",
    border: "border-orange-500/40",
    iconBg: "bg-orange-500/20 border-orange-500/30",
  },
  queue: {
    icon: <MessageSquare className="h-5 w-5 text-rose-400" />,
    stripe: "bg-rose-500",
    border: "border-rose-500/40",
    iconBg: "bg-rose-500/20 border-rose-500/30",
  },
  shield: {
    icon: <Shield className="h-5 w-5 text-red-400" />,
    stripe: "bg-red-500",
    border: "border-red-500/40",
    iconBg: "bg-red-500/20 border-red-500/30",
  },
  default: {
    icon: <Globe className="h-5 w-5 text-violet-400" />,
    stripe: "bg-violet-500",
    border: "border-violet-500/40",
    iconBg: "bg-violet-500/20 border-violet-500/30",
  },
};

interface HardwareNodeProps {
  data: { label: string; subLabel?: string };
  selected?: boolean;
}

const HardwareNode = ({ data, selected }: HardwareNodeProps) => {
  const kind = parseKind(data.subLabel, data.label);
  const style = KIND_STYLES[kind];

  return (
    <div
      className={cn(
        "relative min-w-[200px] rounded-xl border-2 bg-slate-800/95 shadow-lg transition-all duration-200",
        style.border,
        selected
          ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 shadow-indigo-500/20"
          : "hover:shadow-slate-900/50"
      )}
    >
      <div className={cn("h-1.5 w-full rounded-t-[10px]", style.stripe)} />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              style.iconBg
            )}
          >
            {style.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-100">
              {data.label}
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {data.subLabel ?? "Service"}
            </span>
          </div>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="!-top-1.5 !h-2.5 !w-2.5 !border-2 !border-slate-500 !bg-slate-700 hover:!border-indigo-400 !transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!-bottom-1.5 !h-2.5 !w-2.5 !border-2 !border-slate-500 !bg-slate-700 hover:!border-indigo-400 !transition-colors"
      />
    </div>
  );
};

export default memo(HardwareNode);
