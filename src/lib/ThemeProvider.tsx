"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { GameMode, GameTheme, getTheme } from "./gameTheme";

interface ThemeContextValue {
  mode: GameMode;
  theme: GameTheme;
  setMode: (mode: GameMode) => void;
  classicGamesPlayed: number;
  incrementClassicGames: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "classic",
  theme: getTheme("classic"),
  setMode: () => {},
  classicGamesPlayed: 0,
  incrementClassicGames: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode>("classic");
  const [classicGamesPlayed, setClassicGamesPlayed] = useState(0);

  useEffect(() => {
    const count = parseInt(localStorage.getItem("citysleeps-classic-games") ?? "0", 10);
    setClassicGamesPlayed(count);
  }, []);

  const setMode = (m: GameMode) => {
    setModeState(m);
  };

  const incrementClassicGames = () => {
    const next = classicGamesPlayed + 1;
    setClassicGamesPlayed(next);
    localStorage.setItem("citysleeps-classic-games", String(next));
  };

  return (
    <ThemeContext.Provider value={{ mode, theme: getTheme(mode), setMode, classicGamesPlayed, incrementClassicGames }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useGameTheme() {
  return useContext(ThemeContext);
}
