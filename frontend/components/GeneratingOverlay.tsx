"use client";

export function GeneratingOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/95 px-6 py-5 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        <p className="text-sm font-medium text-slate-200">Generating diagram…</p>
        <p className="text-xs text-slate-500">This usually takes a few seconds</p>
      </div>
    </div>
  );
}
