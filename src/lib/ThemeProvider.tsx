"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { GameMode, GameTheme, getTheme } from "./gameTheme";

interface ThemeContextValue {
  mode: GameMode;
  theme: GameTheme;
  setMode: (mode: GameMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dhurandhar",
  theme: getTheme("dhurandhar"),
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode>("dhurandhar");

  useEffect(() => {
    const stored = localStorage.getItem("citysleeps-mode") as GameMode | null;
    if (stored === "classic" || stored === "dhurandhar") {
      setModeState(stored);
    }
  }, []);

  const setMode = (m: GameMode) => {
    setModeState(m);
    localStorage.setItem("citysleeps-mode", m);
  };

  return (
    <ThemeContext.Provider value={{ mode, theme: getTheme(mode), setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useGameTheme() {
  return useContext(ThemeContext);
}
