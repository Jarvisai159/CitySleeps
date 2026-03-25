import { Role } from "@/engine/types";

export type GameMode = "classic" | "dhurandhar";

export interface RoleDisplay {
  name: string;
  symbol: string;
  color: string;
  team: string;
  description: string;
}

export interface GameTheme {
  mode: GameMode;
  brand: { first: string; second: string; subtitle: string; accentSecond?: boolean };
  teamNames: { good: string; evil: string };
  win: {
    goodTitle: string;
    evilTitle: string;
    goodDesc: string;
    evilDesc: string;
  };
  roles: Record<Role, RoleDisplay>;
  narration: {
    roleReveal: string;
    nightFirst: string;
    nightRepeat: string;
    healerPrompt: string;
    detectivePrompt: string;
    dawnKilled: (name: string) => string;
    dawnSaved: string;
    dawnPeaceful: string;
    discussion: string;
    vote: string;
    eliminated: (name: string, roleName: string) => string;
    terroristRevenge: (name: string) => string;
    gameOverGood: string;
    gameOverEvil: string;
  };
  legend: string;
  shareText: (code: string, url: string) => string;
}

const CLASSIC_THEME: GameTheme = {
  mode: "classic",
  brand: { first: "City", second: "Sleeps", subtitle: "The Social Deduction Game" },
  teamNames: { good: "City Team", evil: "Mafia Team" },
  win: {
    goodTitle: "Civilians Win",
    evilTitle: "Mafia Wins",
    goodDesc: "All Mafia members have been found and eliminated.",
    evilDesc: "The Mafia has taken over the city.",
  },
  roles: {
    MAFIA: {
      name: "Mafia", symbol: "M", color: "#C41E3A", team: "mafia",
      description: "Eliminate civilians at night. Stay hidden during the day.",
    },
    TERRORIST: {
      name: "Terrorist", symbol: "T", color: "#E85D04", team: "mafia",
      description: "Mafia-aligned sleeper. Does not wake at night. If voted out, takes one player down.",
    },
    HEALER: {
      name: "Healer", symbol: "H", color: "#2D8B46", team: "city",
      description: "Choose one player to protect each night.",
    },
    DETECTIVE: {
      name: "Detective", symbol: "D", color: "#2563EB", team: "city",
      description: "Investigate one player each night to learn their allegiance.",
    },
    SPY: {
      name: "Spy", symbol: "S", color: "#7C3AED", team: "city",
      description: "Wakes with the Mafia — sees their identities and target. But appears as Mafia to the Detective.",
    },
    CIVILIAN: {
      name: "Civilian", symbol: "C", color: "#9CA3AF", team: "city",
      description: "Find and vote out the Mafia during the day.",
    },
  },
  narration: {
    roleReveal: "Roles have been assigned. Check your phones now. Do not show anyone.",
    nightFirst: "Night falls over the town. Everyone, close your eyes. Mafia, open your eyes. Spy, open your eyes. You may see each other, but only Mafia may choose a target.",
    nightRepeat: "Night falls. Everyone, close your eyes. Mafia and Spy, open your eyes. Mafia, choose your target.",
    healerPrompt: "Mafia and Spy, close your eyes. Healer, open your eyes. Choose someone to protect.",
    detectivePrompt: "Healer, close your eyes. Detective, open your eyes. Choose someone to investigate.",
    dawnKilled: (name) => `Close your eyes. Everyone, open your eyes. The sun rises. Last night, ${name} was killed by the Mafia.`,
    dawnSaved: "Close your eyes. Everyone, open your eyes. The sun rises. No one died last night. The Healer made a crucial save.",
    dawnPeaceful: "Close your eyes. Everyone, open your eyes. The sun rises. It was a peaceful night.",
    discussion: "Discussion begins now. Talk amongst yourselves. Who do you suspect?",
    vote: "Time to vote. Use your phones to cast your vote now.",
    eliminated: (name, roleName) => `The town has spoken. ${name} has been eliminated. They were ${roleName}.`,
    terroristRevenge: (name) => `But the Terrorist's final act takes ${name} down as well!`,
    gameOverGood: "Game over. The Civilians win! All Mafia members have been eliminated.",
    gameOverEvil: "Game over. The Mafia wins! They have taken over the city.",
  },
  legend: "M = Mafia \u00B7 T = Terrorist \u00B7 H = Healer \u00B7 D = Detective \u00B7 S = Spy \u00B7 C = Civilian",
  shareText: (code, url) => `Join my CitySleeps game! Enter code ${code} or click: ${url}`,
};

const DHURANDHAR_THEME: GameTheme = {
  mode: "dhurandhar",
  brand: { first: "Operation", second: "D", subtitle: "Inspired by the Film", accentSecond: true },
  teamNames: { good: "India", evil: "ISI" },
  win: {
    goodTitle: "Operation Success",
    evilTitle: "ISI Wins",
    goodDesc: "All ISI operatives have been identified and neutralised.",
    evilDesc: "The ISI has infiltrated and taken control.",
  },
  roles: {
    MAFIA: {
      name: "ISI Agent", symbol: "I", color: "#1B5E20", team: "isi",
      description: "Eliminate targets at night. Stay hidden during the day. You are an ISI operative in India.",
    },
    TERRORIST: {
      name: "Kasab", symbol: "K", color: "#E85D04", team: "isi",
      description: "ISI sleeper agent. Does not wake at night. If caught and voted out, takes one innocent down with you.",
    },
    HEALER: {
      name: "Aalam Bhai", symbol: "A", color: "#E91E63", team: "india",
      description: "Choose one person to protect each night. Your care saves lives in the shadows of India.",
    },
    DETECTIVE: {
      name: "Ajay Sanyal", symbol: "S", color: "#2563EB", team: "india",
      description: "Investigate one person each night to learn their allegiance. The safety of India rests on your shoulders.",
    },
    SPY: {
      name: "Hamza Ali Mazari", symbol: "H", color: "#FF9933", team: "india",
      description: "India's ace agent — the Dhurandhar. Wakes with ISI — sees their identities and target. But appears as ISI to Ajay Sanyal. Use your intel wisely.",
    },
    CIVILIAN: {
      name: "Awaam", symbol: "W", color: "#9CA3AF", team: "india",
      description: "The people of India. Your power is your voice and your vote. Find the ISI agents and protect your nation.",
    },
  },
  narration: {
    roleReveal: "Roles have been assigned. Check your phones now. Do not reveal your identity to anyone.",
    nightFirst: "Night falls over India. Everyone, close your eyes. ISI agents, open your eyes. Hamza Ali Mazari, open your eyes. You may see each other, but only ISI may choose a target.",
    nightRepeat: "Night falls over India. Everyone, close your eyes. ISI and Hamza, open your eyes. ISI, choose your target.",
    healerPrompt: "ISI and Hamza, close your eyes. Aalam Bhai, open your eyes. Choose someone to protect tonight.",
    detectivePrompt: "Aalam Bhai, close your eyes. Ajay Sanyal, open your eyes. Choose someone to investigate.",
    dawnKilled: (name) => `Close your eyes. Everyone, open your eyes. Dawn breaks over India. Last night, ${name} was eliminated by ISI agents.`,
    dawnSaved: "Close your eyes. Everyone, open your eyes. Dawn breaks over India. No one died last night. Aalam Bhai made a crucial save.",
    dawnPeaceful: "Close your eyes. Everyone, open your eyes. Dawn breaks over India. It was a quiet night.",
    discussion: "Discussion begins. The people of India must decide. Who among you is the enemy?",
    vote: "Time to vote. Use your phones to cast your vote now.",
    eliminated: (name, roleName) => `The people have spoken. ${name} has been eliminated. They were ${roleName}.`,
    terroristRevenge: (name) => `But Kasab's final act takes ${name} down as well!`,
    gameOverGood: "Game over. Operation success! All ISI operatives have been neutralised.",
    gameOverEvil: "Game over. ISI wins! They have taken control.",
  },
  legend: "I = ISI Agent \u00B7 K = Kasab \u00B7 A = Aalam Bhai \u00B7 S = Ajay Sanyal \u00B7 H = Hamza Ali Mazari \u00B7 W = Awaam",
  shareText: (code, url) => `Join my Operation Dhurandhar game! Enter code ${code} or click: ${url}`,
};

export const THEMES: Record<GameMode, GameTheme> = {
  classic: CLASSIC_THEME,
  dhurandhar: DHURANDHAR_THEME,
};

export function getTheme(mode: GameMode): GameTheme {
  return THEMES[mode];
}
