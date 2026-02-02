"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

export interface MermaidEdgeData {
  label?: string;
  edgeType?: "default" | "dashed" | "dotted" | "thick";
  animated?: boolean;
}

export function MermaidStyleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = data as MermaidEdgeData | undefined;
  const label = edgeData?.label;
  const edgeType = edgeData?.edgeType || "default";
  const animated = edgeData?.animated ?? false;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Edge style based on type
  const getEdgeStyle = () => {
    const baseStyle = {
      strokeWidth: 2,
      stroke: "var(--primary)",
      ...style,
    };

    switch (edgeType) {
      case "dashed":
        return { ...baseStyle, strokeDasharray: "8 4" };
      case "dotted":
        return { ...baseStyle, strokeDasharray: "2 2" };
      case "thick":
        return { ...baseStyle, strokeWidth: 3 };
      default:
        return baseStyle;
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={getEdgeStyle()}
        className={animated ? "animated-edge" : ""}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="edge-label rounded-md bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--card-foreground)] shadow-sm border border-[var(--border)]"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Bezier variant for smoother curves
export function MermaidBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = data as MermaidEdgeData | undefined;
  const label = edgeData?.label;
  const animated = edgeData?.animated ?? false;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 2,
          stroke: "var(--primary)",
          ...style,
        }}
        className={animated ? "animated-edge" : ""}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="edge-label rounded-md bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--card-foreground)] shadow-sm border border-[var(--border)]"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
