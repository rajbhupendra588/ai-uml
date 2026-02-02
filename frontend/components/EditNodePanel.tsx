"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EditingNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface EditNodePanelProps {
  node: EditingNode;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
  onCancel: () => void;
  className?: string;
}

export function EditNodePanel({ node, onSave, onCancel, className }: EditNodePanelProps) {
  const [label, setLabel] = useState(String(node.data?.label ?? ""));
  const [subLabel, setSubLabel] = useState(String(node.data?.subLabel ?? ""));
  const [attributes, setAttributes] = useState(String(node.data?.attributes ?? ""));
  const [methods, setMethods] = useState(String(node.data?.methods ?? ""));

  useEffect(() => {
    setLabel(String(node.data?.label ?? ""));
    setSubLabel(String(node.data?.subLabel ?? ""));
    setAttributes(String(node.data?.attributes ?? ""));
    setMethods(String(node.data?.methods ?? ""));
  }, [node.id, node.data]);

  const handleSave = () => {
    const next: Record<string, unknown> = { ...node.data, label: label.trim() || node.data?.label };
    if (node.type === "hardware") {
      next.subLabel = subLabel.trim() || (node.data?.subLabel ?? "Service");
    }
    if (node.type === "class") {
      next.attributes = attributes.trim() || "";
      next.methods = methods.trim() || "";
    }
    onSave(node.id, next);
  };

  const isClass = node.type === "class";
  const isHardware = node.type === "hardware";

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-50 w-full max-w-sm rounded-xl border border-slate-700/80 bg-slate-800/98 shadow-xl",
        className
      )}
      data-diagram-download-hide
    >
      <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-200">Edit node</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Label</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border-slate-600/80 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
            placeholder="Node label"
          />
        </div>
        {isHardware && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Sub-label</label>
            <Input
              value={subLabel}
              onChange={(e) => setSubLabel(e.target.value)}
              className="border-slate-600/80 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
              placeholder="e.g. Service, API"
            />
          </div>
        )}
        {isClass && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Attributes (one per line)</label>
              <textarea
                value={attributes}
                onChange={(e) => setAttributes(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-slate-600/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="attr: Type"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Methods (one per line)</label>
              <textarea
                value={methods}
                onChange={(e) => setMethods(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-slate-600/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="method(args): ReturnType"
              />
            </div>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1 border-slate-600/80 text-slate-300 hover:bg-slate-700/80"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="flex-1 bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
