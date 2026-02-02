"use client";

import React from "react";
import { Layers, ArrowRight, Grid3X3, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DiagramVersion {
  code: string;
  layout: string;
  direction: string;
  description: string;
}

interface VersionSwitcherProps {
  versions: DiagramVersion[];
  selectedIndex: number;
  onSelectVersion: (index: number) => void;
  className?: string;
}

const layoutIcons: Record<string, React.ReactNode> = {
  "Hierarchical": <Layers className="h-3.5 w-3.5" />,
  "Layered": <Layers className="h-3.5 w-3.5" />,
  "Horizontal Flow": <ArrowRight className="h-3.5 w-3.5" />,
  "Horizontal": <ArrowRight className="h-3.5 w-3.5" />,
  "Pipeline": <ArrowRight className="h-3.5 w-3.5" />,
  "Grouped": <Grid3X3 className="h-3.5 w-3.5" />,
  "Compact": <Grid3X3 className="h-3.5 w-3.5" />,
};

export function VersionSwitcher({
  versions,
  selectedIndex,
  onSelectVersion,
  className,
}: VersionSwitcherProps) {
  if (!versions || versions.length <= 1) {
    return null;
  }

  const selectedVersion = versions[selectedIndex];
  
  const goToPrev = () => {
    const newIndex = selectedIndex === 0 ? versions.length - 1 : selectedIndex - 1;
    onSelectVersion(newIndex);
  };
  
  const goToNext = () => {
    const newIndex = selectedIndex === versions.length - 1 ? 0 : selectedIndex + 1;
    onSelectVersion(newIndex);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg",
        className
      )}
    >
      {/* Previous button */}
      <button
        type="button"
        onClick={goToPrev}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        title="Previous layout"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Version buttons */}
      <div className="flex items-center gap-0.5">
        {versions.map((version, index) => {
          const icon = layoutIcons[version.layout] || <Layers className="h-3.5 w-3.5" />;
          const isSelected = index === selectedIndex;
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectVersion(index)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                isSelected
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              )}
              title={version.description}
            >
              {icon}
              <span className="hidden sm:inline">{version.layout}</span>
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={goToNext}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        title="Next layout"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Current layout info */}
      <div className="hidden md:flex items-center gap-2 border-l border-[var(--border)] pl-2 ml-1">
        <span className="text-xs text-[var(--muted)]">
          {selectedVersion?.description || ""}
        </span>
      </div>
    </div>
  );
}

// Compact version for smaller screens
export function VersionSwitcherCompact({
  versions,
  selectedIndex,
  onSelectVersion,
  className,
}: VersionSwitcherProps) {
  if (!versions || versions.length <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5 shadow-lg",
        className
      )}
    >
      {versions.map((version, index) => {
        const icon = layoutIcons[version.layout] || <Layers className="h-3 w-3" />;
        const isSelected = index === selectedIndex;
        
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectVersion(index)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition",
              isSelected
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--secondary)]"
            )}
            title={`${version.layout}: ${version.description}`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
