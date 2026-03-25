"use client";

import { useGameTheme } from "@/lib/ThemeProvider";

export function ModeToggle() {
  const { mode, setMode } = useGameTheme();

  return (
    <div className="flex items-center gap-1 bg-bg-card border border-white/10 rounded-lg p-1">
      <button
        onClick={() => setMode("dhurandhar")}
        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
          mode === "dhurandhar"
            ? "bg-[#FF9933] text-black"
            : "text-muted hover:text-white/70"
        }`}
      >
        Dhurandhar Mode
      </button>
      <button
        onClick={() => setMode("classic")}
        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
          mode === "classic"
            ? "bg-accent-red text-white"
            : "text-muted hover:text-white/70"
        }`}
      >
        Classic Game
      </button>
    </div>
  );
}
