import {
  Player,
  Role,
  GamePhase,
  GameSettings,
  NightActions,
  NightResult,
  VoteResult,
  GameState,
  PublicPlayer,
  PrivateMessage,
} from "./types";

const DEFAULT_SETTINGS: GameSettings = {
  discussionTime: 120,
  votingTime: 60,
  healerSelfHeal: true,
};

function getRoleDistribution(count: number): Record<Role, number> {
  if (count <= 5)
    return { MAFIA: 1, TERRORIST: 0, HEALER: 1, DETECTIVE: 1, SPY: 0, CIVILIAN: count - 3 };
  if (count <= 7)
    return { MAFIA: 1, TERRORIST: 1, HEALER: 1, DETECTIVE: 1, SPY: 0, CIVILIAN: count - 4 };
  if (count <= 9)
    return { MAFIA: 2, TERRORIST: 1, HEALER: 1, DETECTIVE: 1, SPY: 1, CIVILIAN: count - 6 };
  if (count <= 12)
    return { MAFIA: 2, TERRORIST: 1, HEALER: 1, DETECTIVE: 1, SPY: 1, CIVILIAN: count - 6 };
  return { MAFIA: 3, TERRORIST: 1, HEALER: 1, DETECTIVE: 1, SPY: 1, CIVILIAN: count - 7 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mafia win-condition team (Mafia + Terrorist) */
function isMafiaTeam(role: Role): boolean {
  return role === "MAFIA" || role === "TERRORIST";
}

/** What the Detective sees — Spy appears as Mafia */
function appearsAsMafia(role: Role): boolean {
  return role === "MAFIA" || role === "TERRORIST" || role === "SPY";
}

export class GameEngine {
  players: Map<string, Player> = new Map();
  phase: GamePhase = "LOBBY";
  round = 0;
  nightActions: NightActions = {
    mafiaVotes: {},
    mafiaTarget: null,
    healerSave: null,
    detectiveTarget: null,
  };
  votes: Record<string, string> = {};
  settings: GameSettings;
  nightResult: NightResult | null = null;
  voteResult: VoteResult | null = null;
  winner: "MAFIA" | "CITY" | null = null;
  lastHealerSave: string | null = null;

  private onStateChange: (state: GameState) => void;
  private onPrivateMessage: (playerId: string, msg: PrivateMessage) => void;

  constructor(
    onStateChange: (state: GameState) => void,
    onPrivateMessage: (playerId: string, msg: PrivateMessage) => void,
    settings?: Partial<GameSettings>
  ) {
    this.onStateChange = onStateChange;
    this.onPrivateMessage = onPrivateMessage;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  addPlayer(id: string, name: string): Player {
    if (this.phase !== "LOBBY") throw new Error("Game already started");
    if (this.players.size >= 15) throw new Error("Room is full");
    if (this.players.has(id)) {
      const p = this.players.get(id)!;
      p.isConnected = true;
      return p;
    }
    for (const p of this.players.values()) {
      if (p.name.toLowerCase() === name.toLowerCase())
        throw new Error("Name already taken");
    }
    const player: Player = { id, name, role: null, isAlive: true, isConnected: true, deathRound: null };
    this.players.set(id, player);
    this.broadcastState();
    return player;
  }

  removePlayer(id: string): void {
    if (this.phase === "LOBBY") {
      this.players.delete(id);
      this.broadcastState();
    } else {
      const p = this.players.get(id);
      if (p) p.isConnected = false;
    }
  }

  getPublicPlayers(): PublicPlayer[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id, name: p.name, isAlive: p.isAlive, isConnected: p.isConnected,
    }));
  }

  getGameState(): GameState {
    const state: GameState = {
      phase: this.phase,
      round: this.round,
      players: this.getPublicPlayers(),
      nightResult: this.nightResult,
      voteResult: this.voteResult,
      winner: this.winner,
      timer: null,
    };
    if (this.phase === "DAY_VOTING") {
      const tally: Record<string, number> = {};
      for (const targetId of Object.values(this.votes)) {
        if (targetId !== "skip") tally[targetId] = (tally[targetId] || 0) + 1;
      }
      state.voteTally = tally;
      state.votes = { ...this.votes };
    }
    if (this.phase === "GAME_OVER") {
      state.allRoles = Object.fromEntries(
        Array.from(this.players.entries()).map(([id, p]) => [id, p.role!])
      );
    }
    return state;
  }

  // ─── Game Start ───────────────────────────────────────

  startGame(): void {
    if (this.players.size < 4) throw new Error("Need at least 4 players");
    if (this.phase !== "LOBBY") throw new Error("Game already started");

    this.assignRoles();
    this.phase = "ROLE_REVEAL";
    this.round = 1;

    // Build Mafia member names list (Mafia + Terrorist — NOT Spy)
    const mafiaNames = Array.from(this.players.values())
      .filter((p) => isMafiaTeam(p.role!))
      .map((p) => `${p.name} (${p.role})`);

    for (const [id, player] of this.players) {
      let teamInfo: string[] | undefined;

      if (player.role === "MAFIA") {
        // Mafia sees other Mafia + Terrorist (but NOT Spy)
        teamInfo = mafiaNames.filter((n) => !n.startsWith(player.name + " "));
      } else if (player.role === "TERRORIST") {
        // Terrorist knows Mafia members
        teamInfo = mafiaNames.filter((n) => !n.startsWith(player.name + " "));
      } else if (player.role === "SPY") {
        // Spy knows ALL Mafia team members (they observe them at night)
        teamInfo = mafiaNames;
      }

      this.onPrivateMessage(id, {
        type: "role-assigned",
        role: player.role!,
        mafiaTeam: teamInfo,
      });
    }

    this.broadcastState();
  }

  private assignRoles(): void {
    const dist = getRoleDistribution(this.players.size);
    const roles: Role[] = [];
    for (const [role, count] of Object.entries(dist)) {
      for (let i = 0; i < count; i++) roles.push(role as Role);
    }
    const shuffled = shuffle(roles);
    const ids = Array.from(this.players.keys());
    ids.forEach((id, i) => {
      this.players.get(id)!.role = shuffled[i];
    });
  }

  // ─── Night Phase ──────────────────────────────────────

  startNight(): void {
    this.nightActions = {
      mafiaVotes: {},
      mafiaTarget: null,
      healerSave: null,
      detectiveTarget: null,
    };
    this.nightResult = null;
    this.voteResult = null;
    this.phase = "NIGHT_MAFIA";
    this.broadcastState();
    this.sendMafiaPrompts();
  }

  private sendMafiaPrompts(): void {
    const alive = this.getAlivePlayers();
    // Only MAFIA votes at night (not Terrorist, not Spy)
    const mafiaVoters = alive.filter((p) => p.role === "MAFIA");
    const targets = alive.filter((p) => !isMafiaTeam(p.role!));

    for (const p of mafiaVoters) {
      this.onPrivateMessage(p.id, {
        type: "action-prompt",
        actionType: "mafia-kill",
        targets: targets.map((t) => ({
          id: t.id, name: t.name, isAlive: t.isAlive, isConnected: t.isConnected,
        })),
      });
    }

    // Spy wakes up too — but just watches. They see a "watching" state.
    // Spy intel (who Mafia targeted) is sent AFTER Mafia finishes voting.
  }

  submitNightAction(playerId: string, targetId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    if (this.phase === "NIGHT_MAFIA" && player.role === "MAFIA") {
      this.nightActions.mafiaVotes[playerId] = targetId;
      this.onPrivateMessage(playerId, { type: "action-confirmed" });
      // Check if all MAFIA (not Terrorist) have voted
      const aliveMafia = this.getAlivePlayers().filter((p) => p.role === "MAFIA");
      if (Object.keys(this.nightActions.mafiaVotes).length >= aliveMafia.length) {
        this.resolveMafiaVote();
        this.sendSpyIntel();
        this.advanceNight();
      }
    } else if (this.phase === "NIGHT_HEALER" && player.role === "HEALER") {
      this.nightActions.healerSave = targetId;
      this.onPrivateMessage(playerId, { type: "action-confirmed" });
      this.advanceNight();
    } else if (this.phase === "NIGHT_DETECTIVE" && player.role === "DETECTIVE") {
      this.nightActions.detectiveTarget = targetId;
      const target = this.players.get(targetId);
      if (target) {
        this.onPrivateMessage(playerId, {
          type: "detective-result",
          investigationResult: {
            playerName: target.name,
            // Spy appears as Mafia to Detective!
            isMafia: appearsAsMafia(target.role!),
          },
        });
      }
      this.advanceNight();
    }
  }

  private resolveMafiaVote(): void {
    const votes = Object.values(this.nightActions.mafiaVotes);
    if (votes.length === 0) return;
    const tally: Record<string, number> = {};
    for (const v of votes) tally[v] = (tally[v] || 0) + 1;
    const maxVotes = Math.max(...Object.values(tally));
    const top = Object.keys(tally).filter((k) => tally[k] === maxVotes);
    this.nightActions.mafiaTarget = top[Math.floor(Math.random() * top.length)];
  }

  /** After Mafia votes, send the Spy intel about who was targeted */
  private sendSpyIntel(): void {
    const spy = this.getAlivePlayers().find((p) => p.role === "SPY");
    if (!spy || !this.nightActions.mafiaTarget) return;

    const targetPlayer = this.players.get(this.nightActions.mafiaTarget);
    if (targetPlayer) {
      this.onPrivateMessage(spy.id, {
        type: "spy-intel",
        spyIntel: { mafiaTargetName: targetPlayer.name },
      });
    }
  }

  private advanceNight(): void {
    const alive = this.getAlivePlayers();

    if (this.phase === "NIGHT_MAFIA") {
      const healer = alive.find((p) => p.role === "HEALER");
      if (healer) {
        this.phase = "NIGHT_HEALER";
        const targets = alive.filter((p) => {
          if (!this.settings.healerSelfHeal && p.id === healer.id) return false;
          if (this.lastHealerSave === p.id) return false;
          return true;
        });
        this.onPrivateMessage(healer.id, {
          type: "action-prompt",
          actionType: "healer-save",
          targets: targets.map((t) => ({ id: t.id, name: t.name, isAlive: t.isAlive, isConnected: t.isConnected })),
        });
        this.broadcastState();
        return;
      }
    }

    if (this.phase === "NIGHT_MAFIA" || this.phase === "NIGHT_HEALER") {
      if (this.phase === "NIGHT_HEALER") this.lastHealerSave = this.nightActions.healerSave;
      const detective = alive.find((p) => p.role === "DETECTIVE");
      if (detective) {
        this.phase = "NIGHT_DETECTIVE";
        const targets = alive.filter((p) => p.id !== detective.id);
        this.onPrivateMessage(detective.id, {
          type: "action-prompt",
          actionType: "detective-investigate",
          targets: targets.map((t) => ({ id: t.id, name: t.name, isAlive: t.isAlive, isConnected: t.isConnected })),
        });
        this.broadcastState();
        return;
      }
    }

    // All night actions done — resolve
    this.resolveNight();
  }

  private resolveNight(): void {
    if (this.phase === "NIGHT_HEALER") this.lastHealerSave = this.nightActions.healerSave;

    const target = this.nightActions.mafiaTarget;
    const saved = target !== null && target === this.nightActions.healerSave;

    if (target && !saved) {
      const victim = this.players.get(target);
      if (victim) {
        victim.isAlive = false;
        victim.deathRound = this.round;
        this.nightResult = { killed: target, savedByHealer: false, killedPlayerName: victim.name };
      }
    } else {
      this.nightResult = { killed: null, savedByHealer: saved, killedPlayerName: null };
    }

    this.phase = "DAWN";
    this.broadcastState();

    const win = this.checkWinCondition();
    if (win) {
      this.winner = win;
      this.phase = "GAME_OVER";
      this.broadcastState();
    }
  }

  // ─── Day Phase ────────────────────────────────────────

  startDayDiscussion(): void {
    if (this.winner) return;
    this.phase = "DAY_DISCUSSION";
    this.votes = {};
    this.broadcastState();
  }

  startVoting(): void {
    this.phase = "DAY_VOTING";
    this.votes = {};
    this.broadcastState();
  }

  submitVote(playerId: string, targetId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive || this.phase !== "DAY_VOTING") return;
    this.votes[playerId] = targetId;
    this.broadcastState();

    const alive = this.getAlivePlayers();
    if (Object.keys(this.votes).length >= alive.length) {
      this.resolveVoting();
    }
  }

  private resolveVoting(): void {
    const tally: Record<string, number> = {};
    for (const targetId of Object.values(this.votes)) {
      if (targetId !== "skip") tally[targetId] = (tally[targetId] || 0) + 1;
    }

    const aliveCount = this.getAlivePlayers().length;
    const majority = Math.floor(aliveCount / 2) + 1;

    let eliminated: string | null = null;
    let maxVotes = 0;
    let isTie = false;

    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; eliminated = id; isTie = false; }
      else if (count === maxVotes) { isTie = true; }
    }

    if (maxVotes < majority || isTie) eliminated = null;

    let eliminatedRole: Role | null = null;
    let eliminatedName: string | null = null;
    let terroristVictim: string | null = null;
    let terroristVictimName: string | null = null;

    if (eliminated) {
      const p = this.players.get(eliminated);
      if (p) {
        p.isAlive = false;
        p.deathRound = this.round;
        eliminatedRole = p.role;
        eliminatedName = p.name;

        // Terrorist revenge
        if (p.role === "TERRORIST") {
          const aliveCitizens = this.getAlivePlayers().filter((v) => !isMafiaTeam(v.role!));
          if (aliveCitizens.length > 0) {
            const victim = aliveCitizens[Math.floor(Math.random() * aliveCitizens.length)];
            victim.isAlive = false;
            victim.deathRound = this.round;
            terroristVictim = victim.id;
            terroristVictimName = victim.name;
          }
        }
      }
    }

    this.voteResult = {
      votes: { ...this.votes }, tally, eliminated, eliminatedName,
      eliminatedRole, isTie, terroristVictim, terroristVictimName,
    };

    this.phase = "ELIMINATION";
    this.broadcastState();

    const win = this.checkWinCondition();
    if (win) {
      this.winner = win;
      this.phase = "GAME_OVER";
      this.broadcastState();
    }
  }

  proceedAfterElimination(): void {
    if (this.winner) return;
    this.round++;
    this.startNight();
  }

  // ─── Force Resolve ────────────────────────────────────

  forceResolveCurrentPhase(): void {
    if (this.phase === "NIGHT_MAFIA") {
      if (Object.keys(this.nightActions.mafiaVotes).length === 0) {
        const targets = this.getAlivePlayers().filter((p) => !isMafiaTeam(p.role!));
        const rand = targets[Math.floor(Math.random() * targets.length)];
        if (rand) this.nightActions.mafiaVotes["auto"] = rand.id;
      }
      this.resolveMafiaVote();
      this.sendSpyIntel();
      this.advanceNight();
    } else if (this.phase === "NIGHT_HEALER") {
      this.advanceNight();
    } else if (this.phase === "NIGHT_DETECTIVE") {
      this.advanceNight();
    } else if (this.phase === "DAY_VOTING") {
      for (const p of this.getAlivePlayers()) {
        if (!this.votes[p.id]) this.votes[p.id] = "skip";
      }
      this.resolveVoting();
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  getAlivePlayers(): Player[] {
    return Array.from(this.players.values()).filter((p) => p.isAlive);
  }

  private checkWinCondition(): "MAFIA" | "CITY" | null {
    const alive = this.getAlivePlayers();
    const mafiaCount = alive.filter((p) => isMafiaTeam(p.role!)).length;
    const cityCount = alive.filter((p) => !isMafiaTeam(p.role!)).length;
    if (mafiaCount === 0) return "CITY";
    if (mafiaCount >= cityCount) return "MAFIA";
    return null;
  }

  getGameResult(): {
    winner: "MAFIA" | "CITY";
    totalRounds: number;
    players: Array<{
      userId: string;
      name: string;
      role: Role;
      team: string;
      survived: boolean;
      survivalRound: number;
    }>;
  } | null {
    if (this.phase !== "GAME_OVER" || !this.winner) return null;
    const ROLE_TEAMS: Record<string, string> = {
      MAFIA: "mafia", TERRORIST: "mafia",
      HEALER: "city", DETECTIVE: "city", SPY: "city", CIVILIAN: "city",
    };
    return {
      winner: this.winner,
      totalRounds: this.round,
      players: Array.from(this.players.values()).map((p) => ({
        userId: p.id,
        name: p.name,
        role: p.role!,
        team: ROLE_TEAMS[p.role!] ?? "city",
        survived: p.isAlive,
        survivalRound: p.deathRound ?? this.round,
      })),
    };
  }

  /** Reset game back to LOBBY keeping all connected players */
  resetToLobby(): void {
    for (const player of this.players.values()) {
      player.role = null;
      player.isAlive = true;
      player.deathRound = null;
    }
    this.phase = "LOBBY";
    this.round = 0;
    this.nightActions = { mafiaVotes: {}, mafiaTarget: null, healerSave: null, detectiveTarget: null };
    this.votes = {};
    this.nightResult = null;
    this.voteResult = null;
    this.winner = null;
    this.lastHealerSave = null;
    this.broadcastState();
  }

  private broadcastState(): void {
    this.onStateChange(this.getGameState());
  }
}
