export type Role = "MAFIA" | "HEALER" | "DETECTIVE" | "SPY" | "TERRORIST" | "CIVILIAN";

export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT_MAFIA"
  | "NIGHT_HEALER"
  | "NIGHT_DETECTIVE"
  | "DAWN"
  | "DAY_DISCUSSION"
  | "DAY_VOTING"
  | "ELIMINATION"
  | "TERRORIST_REVENGE"
  | "GAME_OVER";

export interface Player {
  id: string;
  name: string;
  role: Role | null;
  isAlive: boolean;
  isConnected: boolean;
  deathRound: number | null;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
}

export interface GameSettings {
  discussionTime: number;
  votingTime: number;
  healerSelfHeal: boolean;
}

export interface NightActions {
  mafiaVotes: Record<string, string>;
  mafiaTarget: string | null;
  healerSave: string | null;
  detectiveTarget: string | null;
}

export interface NightResult {
  killed: string | null;
  savedByHealer: boolean;
  killedPlayerName: string | null;
  terroristVictimName: string | null;
}

export interface VoteResult {
  votes: Record<string, string>;
  tally: Record<string, number>;
  eliminated: string | null;
  eliminatedName: string | null;
  eliminatedRole: Role | null;
  isTie: boolean;
  terroristVictim: string | null;
  terroristVictimName: string | null;
  terroristPending?: boolean;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  players: PublicPlayer[];
  nightResult: NightResult | null;
  voteResult: VoteResult | null;
  winner: "MAFIA" | "CITY" | null;
  timer: number | null;
  allRoles?: Record<string, Role>;
  votes?: Record<string, string>;
  voteTally?: Record<string, number>;
}

export interface PrivateMessage {
  type:
    | "role-assigned"
    | "action-prompt"
    | "detective-result"
    | "spy-intel"
    | "action-confirmed"
    | "pending";
  role?: Role;
  mafiaTeam?: string[];
  actionType?: "mafia-kill" | "healer-save" | "detective-investigate" | "terrorist-revenge";
  targets?: PublicPlayer[];
  investigationResult?: { playerName: string; isMafia: boolean };
  spyIntel?: { mafiaTargetName: string };
  message?: string;
}

export interface PlayerAction {
  type: "join" | "night-action" | "vote" | "role-seen" | "terrorist-revenge";
  playerId: string;
  playerName?: string;
  targetId?: string;
}

export const ROLE_INFO: Record<
  Role,
  { name: string; symbol: string; color: string; team: string; description: string }
> = {
  MAFIA: {
    name: "Mafia",
    symbol: "M",
    color: "#C41E3A",
    team: "mafia",
    description: "Eliminate civilians at night. Stay hidden during the day.",
  },
  TERRORIST: {
    name: "Terrorist",
    symbol: "T",
    color: "#E85D04",
    team: "mafia",
    description: "Mafia-aligned sleeper. Does not wake at night. If voted out, takes one player down.",
  },
  HEALER: {
    name: "Healer",
    symbol: "H",
    color: "#2D8B46",
    team: "city",
    description: "Choose one player to protect each night.",
  },
  DETECTIVE: {
    name: "Detective",
    symbol: "?",
    color: "#2563EB",
    team: "city",
    description: "Investigate one player each night to learn their allegiance.",
  },
  SPY: {
    name: "Spy",
    symbol: "S",
    color: "#7C3AED",
    team: "city",
    description: "Wakes with the Mafia — sees their identities and target. But appears as Mafia to the Detective.",
  },
  CIVILIAN: {
    name: "Civilian",
    symbol: "C",
    color: "#9CA3AF",
    team: "city",
    description: "Find and vote out the Mafia during the day.",
  },
};
