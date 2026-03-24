"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GameState, PrivateMessage, Role, ROLE_INFO } from "@/engine/types";
import {
  getSupabase,
  getPublicChannel,
  getHostChannel,
  getPlayerChannel,
} from "@/lib/supabase";
import { generatePlayerId } from "@/lib/utils";
import { playVoteSound } from "@/lib/sounds";

function PlayerPageInner() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [screen, setScreen] = useState<"join" | "lobby" | "game">("join");
  const [roomCode, setRoomCode] = useState(codeFromUrl);
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [mafiaTeam, setMafiaTeam] = useState<string[]>([]);
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [actionPrompt, setActionPrompt] = useState<PrivateMessage | null>(null);
  const [actionSubmitted, setActionSubmitted] = useState(false);
  const [detectiveResult, setDetectiveResult] = useState<{ playerName: string; isMafia: boolean } | null>(null);
  const [spyIntel, setSpyIntel] = useState<{ mafiaTargetName: string } | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem("citysleeps-player-id");
    if (stored) {
      setPlayerId(stored);
    } else {
      const id = generatePlayerId();
      setPlayerId(id);
      sessionStorage.setItem("citysleeps-player-id", id);
    }
  }, []);

  useEffect(() => {
    if (codeFromUrl) setRoomCode(codeFromUrl);
  }, [codeFromUrl]);

  const sendAction = useCallback(
    (action: Record<string, unknown>) => {
      if (!roomCode) return;
      getSupabase().channel(getHostChannel(roomCode)).send({
        type: "broadcast",
        event: "player-action",
        payload: action,
      });
    },
    [roomCode]
  );

  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase === "ROLE_REVEAL") setRoleRevealed(false);
    if (phase.startsWith("NIGHT")) {
      setActionSubmitted(false);
      setActionPrompt(null);
      setDetectiveResult(null);
      setSpyIntel(null);
    }
    if (phase === "DAY_VOTING") setHasVoted(false);
  }, [gameState?.phase]);

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();
    if (!code || code.length < 4) { setError("Enter a valid room code"); return; }
    if (!name) { setError("Enter your name"); return; }
    if (name.length > 15) { setError("Name too long (max 15 chars)"); return; }

    setRoomCode(code);
    setError(null);

    let sb;
    try { sb = getSupabase(); } catch {
      setError("Supabase not configured. Contact the host.");
      return;
    }

    const publicCh = sb
      .channel(getPublicChannel(code))
      .on("broadcast", { event: "game-state" }, ({ payload }) => {
        setGameState(payload as GameState);
        if ((payload as GameState).phase !== "LOBBY") setScreen("game");
      })
      .subscribe();

    const hostCh = sb.channel(getHostChannel(code)).subscribe();

    const privateCh = sb
      .channel(getPlayerChannel(code, playerId))
      .on("broadcast", { event: "private-msg" }, ({ payload }) => {
        const msg = payload as PrivateMessage;
        if (msg.type === "role-assigned") {
          setMyRole(msg.role ?? null);
          setMafiaTeam(msg.mafiaTeam ?? []);
          setScreen("game");
        } else if (msg.type === "action-prompt") {
          setActionPrompt(msg);
          setActionSubmitted(false);
        } else if (msg.type === "detective-result" && msg.investigationResult) {
          setDetectiveResult(msg.investigationResult);
        } else if (msg.type === "spy-intel" && msg.spyIntel) {
          setSpyIntel(msg.spyIntel);
        } else if (msg.type === "action-confirmed") {
          setActionSubmitted(true);
        }
      })
      .subscribe();

    channelsRef.current = [publicCh, hostCh, privateCh];

    setTimeout(() => {
      sendAction({ type: "join", playerId, playerName: name });
    }, 500);

    setScreen("lobby");
  };

  useEffect(() => {
    return () => {
      try { channelsRef.current.forEach((ch) => getSupabase().removeChannel(ch)); } catch { /* */ }
    };
  }, []);

  const handleNightAction = (targetId: string) => {
    sendAction({ type: "night-action", playerId, targetId });
    setActionSubmitted(true);
    playVoteSound();
  };

  const handleVote = (targetId: string) => {
    sendAction({ type: "vote", playerId, targetId });
    setHasVoted(true);
    playVoteSound();
  };

  const amAlive = gameState?.players.find((p) => p.id === playerId)?.isAlive ?? true;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-8 safe-bottom">
      <AnimatePresence mode="wait">
        {/* ─── JOIN ────────────────────────────────── */}
        {screen === "join" && (
          <motion.div key="join" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
            <div className="w-12 h-px bg-accent-red mx-auto mb-8" />
            <h1 className="text-2xl font-black text-center uppercase tracking-wider mb-10">
              <span className="text-accent-red">City</span>Sleeps
            </h1>

            <div className="space-y-5 mb-8">
              <div>
                <label className="text-muted text-xs uppercase tracking-widest block mb-2">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  maxLength={4}
                  className="w-full bg-bg-card border border-white/10 rounded-lg px-4 py-4 text-center text-2xl font-black tracking-[0.3em] focus:outline-none focus:border-accent-red/50 transition-colors uppercase"
                  autoFocus={!codeFromUrl}
                />
              </div>
              <div>
                <label className="text-muted text-xs uppercase tracking-widest block mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                  placeholder="Enter name"
                  maxLength={15}
                  className="w-full bg-bg-card border border-white/10 rounded-lg px-4 py-4 text-center text-lg focus:outline-none focus:border-accent-red/50 transition-colors"
                  autoFocus={!!codeFromUrl}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
            </div>

            {error && <p className="text-accent-red text-sm text-center mb-4">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={!roomCode || !playerName.trim()}
              className="w-full py-4 bg-accent-red hover:bg-accent-crimson disabled:bg-bg-elevated disabled:text-muted text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors"
            >
              Join Game
            </button>
          </motion.div>
        )}

        {/* ─── LOBBY ───────────────────────────────── */}
        {screen === "lobby" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="w-3 h-3 rounded-full bg-accent-red mx-auto mb-8" />
            <h2 className="text-xl font-bold mb-2">You&apos;re in</h2>
            <p className="text-muted text-sm mb-4">
              Room <span className="text-accent-red font-black tracking-wider">{roomCode}</span>
            </p>
            <p className="text-muted text-xs uppercase tracking-widest">Waiting for host to start...</p>
            {gameState && (
              <p className="text-muted text-xs mt-4">{gameState.players.length} player{gameState.players.length !== 1 ? "s" : ""} connected</p>
            )}
          </motion.div>
        )}

        {/* ─── IN GAME ─────────────────────────────── */}
        {screen === "game" && gameState && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
            <AnimatePresence mode="wait">

              {/* ROLE REVEAL */}
              {gameState.phase === "ROLE_REVEAL" && myRole && (
                <motion.div key="role-reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  {!roleRevealed ? (
                    <div>
                      <p className="text-muted text-sm mb-6">Tap to reveal your role</p>
                      <button
                        onClick={() => setRoleRevealed(true)}
                        className="w-44 h-60 bg-bg-card border-2 border-white/10 rounded-lg flex items-center justify-center mx-auto hover:border-white/20 transition-colors"
                      >
                        <span className="text-3xl font-black text-muted">?</span>
                      </button>
                    </div>
                  ) : (
                    <motion.div initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
                      <div
                        className="w-52 mx-auto rounded-lg p-6 border-2"
                        style={{ borderColor: ROLE_INFO[myRole].color, background: `${ROLE_INFO[myRole].color}10` }}
                      >
                        <div
                          className="w-14 h-14 rounded-lg mx-auto mb-4 flex items-center justify-center text-2xl font-black"
                          style={{ backgroundColor: `${ROLE_INFO[myRole].color}20`, color: ROLE_INFO[myRole].color }}
                        >
                          {ROLE_INFO[myRole].symbol}
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: ROLE_INFO[myRole].color }}>
                          {ROLE_INFO[myRole].name}
                        </h3>
                        <p className="text-muted-light text-xs leading-relaxed">{ROLE_INFO[myRole].description}</p>
                        {mafiaTeam.length > 0 && (
                          <p className="text-accent-red/70 text-xs mt-3 pt-3 border-t border-white/5">
                            Allies: {mafiaTeam.join(", ")}
                          </p>
                        )}
                      </div>
                      <p className="text-muted text-xs mt-4 uppercase tracking-wider">Memorize this. Do not show anyone.</p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* NIGHT */}
              {gameState.phase.startsWith("NIGHT") && (
                <motion.div key={`night-${gameState.phase}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  {!amAlive ? (
                    <DeadScreen />
                  ) : actionPrompt && !actionSubmitted ? (
                    <NightActionUI prompt={actionPrompt} detectiveResult={detectiveResult} onSelect={handleNightAction} />
                  ) : actionSubmitted ? (
                    <div>
                      <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-6" />
                      <p className="text-muted-light text-sm">Action submitted. Waiting for others...</p>
                    </div>
                  ) : myRole === "SPY" && gameState.phase === "NIGHT_MAFIA" ? (
                    <div>
                      <div
                        className="w-10 h-10 rounded-lg mx-auto mb-4 flex items-center justify-center text-lg font-black"
                        style={{ backgroundColor: `${ROLE_INFO.SPY.color}20`, color: ROLE_INFO.SPY.color }}
                      >
                        S
                      </div>
                      <p className="text-purple-400 text-sm font-bold uppercase tracking-widest mb-2">You are watching</p>
                      <p className="text-muted text-xs">The Mafia is choosing their target...</p>
                      {spyIntel && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-purple-950/20 border border-purple-500/20 rounded-lg">
                          <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Intel Received</p>
                          <p className="text-white text-sm">Mafia targeted <strong>{spyIntel.mafiaTargetName}</strong></p>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <motion.div animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 4, repeat: Infinity }} className="w-3 h-3 rounded-full bg-blue-400 mx-auto mb-6" />
                      <p className="text-muted-light text-sm uppercase tracking-widest">Close your eyes</p>
                      <p className="text-muted text-xs mt-2">Night is happening...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* DAWN */}
              {gameState.phase === "DAWN" && (
                <motion.div key="dawn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <div className="w-3 h-3 rounded-full bg-amber-400 mx-auto mb-6" />
                  <h3 className="text-xl font-black uppercase tracking-wider mb-4">Dawn</h3>
                  {gameState.nightResult?.killed ? (
                    <p className="text-accent-red font-bold">{gameState.nightResult.killedPlayerName} was killed.</p>
                  ) : gameState.nightResult?.savedByHealer ? (
                    <p className="text-green-500 font-bold">No one died — the Healer saved someone.</p>
                  ) : (
                    <p className="text-muted-light">A peaceful night.</p>
                  )}
                  {!amAlive && <DeadBadge />}
                </motion.div>
              )}

              {/* DAY DISCUSSION */}
              {gameState.phase === "DAY_DISCUSSION" && (
                <motion.div key="discussion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  {!amAlive ? <DeadScreen /> : (
                    <>
                      <h3 className="text-xl font-black uppercase tracking-wider mb-2">Discussion</h3>
                      <p className="text-muted text-xs uppercase tracking-widest">Talk with your group</p>
                      {myRole && (
                        <div className="mt-6 p-3 bg-bg-card border border-white/5 rounded-lg">
                          <p className="text-muted text-[10px] uppercase tracking-widest mb-1">Your Role</p>
                          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: ROLE_INFO[myRole].color }}>
                            {ROLE_INFO[myRole].name}
                          </p>
                        </div>
                      )}
                      {detectiveResult && (
                        <div className="mt-3 p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg">
                          <p className="text-blue-400 text-xs">
                            Investigation: <strong>{detectiveResult.playerName}</strong> is{" "}
                            <strong>{detectiveResult.isMafia ? "MAFIA" : "NOT Mafia"}</strong>
                          </p>
                        </div>
                      )}
                      {spyIntel && (
                        <div className="mt-3 p-3 bg-purple-950/20 border border-purple-500/20 rounded-lg">
                          <p className="text-purple-400 text-xs">
                            Intel: Mafia targeted <strong>{spyIntel.mafiaTargetName}</strong> last night
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* DAY VOTING */}
              {gameState.phase === "DAY_VOTING" && (
                <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full">
                  {!amAlive ? <DeadScreen /> : hasVoted ? (
                    <div>
                      <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-6" />
                      <p className="text-muted-light text-sm">Vote cast. Waiting for others...</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-wider mb-2">Cast Your Vote</h3>
                      <p className="text-muted text-xs mb-6">Who should be eliminated?</p>
                      <div className="space-y-2">
                        {gameState.players.filter((p) => p.isAlive && p.id !== playerId).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleVote(p.id)}
                            className="w-full py-4 px-5 bg-bg-card hover:bg-accent-red/10 border border-white/10 hover:border-accent-red/30 rounded-lg text-left text-sm font-medium transition-all active:scale-[0.98]"
                          >
                            {p.name}
                          </button>
                        ))}
                        <button
                          onClick={() => handleVote("skip")}
                          className="w-full py-4 px-5 bg-bg-card/50 hover:bg-bg-hover border border-white/5 rounded-lg text-left text-sm text-muted font-medium transition-all"
                        >
                          Skip Vote
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ELIMINATION */}
              {gameState.phase === "ELIMINATION" && (
                <motion.div key="elimination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <div className="w-12 h-px bg-accent-red mx-auto mb-6" />
                  {gameState.voteResult?.eliminated ? (
                    <>
                      <h3 className="text-xl font-black uppercase tracking-wider mb-2">
                        {gameState.voteResult.eliminatedName}
                      </h3>
                      <p className="text-sm font-bold uppercase tracking-wider" style={{ color: ROLE_INFO[gameState.voteResult.eliminatedRole!]?.color }}>
                        {ROLE_INFO[gameState.voteResult.eliminatedRole!]?.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-black uppercase tracking-wider mb-2">No Elimination</h3>
                      <p className="text-muted text-sm">{gameState.voteResult?.isTie ? "Tied vote." : "No majority."}</p>
                    </>
                  )}
                  {!amAlive && <DeadBadge />}
                </motion.div>
              )}

              {/* GAME OVER */}
              {gameState.phase === "GAME_OVER" && (
                <motion.div key="gameover" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center w-full">
                  <div className="w-16 h-px bg-accent-red mx-auto mb-6" />
                  <p className="text-muted text-xs uppercase tracking-[0.3em] mb-2">Game Over</p>
                  <h2 className="text-2xl font-black uppercase tracking-wider mb-2">
                    {gameState.winner === "VILLAGE" ? "Civilians Win" : <span className="text-accent-red">Mafia Wins</span>}
                  </h2>
                  {myRole && (
                    <p className="text-muted-light text-sm mb-8">
                      You were <span className="font-bold uppercase" style={{ color: ROLE_INFO[myRole].color }}>{ROLE_INFO[myRole].name}</span>
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {gameState.players.map((p) => {
                      const role = gameState.allRoles?.[p.id];
                      return (
                        <div key={p.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${p.id === playerId ? "bg-bg-elevated border border-white/10" : "bg-bg-card border border-white/5"}`}>
                          <span className={p.isAlive ? "text-sm font-medium" : "text-sm font-medium line-through text-muted"}>
                            {p.name}{p.id === playerId && <span className="text-muted text-xs ml-1">(you)</span>}
                          </span>
                          {role && (
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ROLE_INFO[role].color }}>
                              {ROLE_INFO[role].name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function NightActionUI({
  prompt,
  detectiveResult,
  onSelect,
}: {
  prompt: PrivateMessage;
  detectiveResult: { playerName: string; isMafia: boolean } | null;
  onSelect: (targetId: string) => void;
}) {
  const labels: Record<string, { title: string; symbol: string; color: string }> = {
    "mafia-kill": { title: "Choose Target", symbol: "M", color: "#C41E3A" },
    "healer-save": { title: "Choose Who to Save", symbol: "H", color: "#2D8B46" },
    "detective-investigate": { title: "Investigate", symbol: "?", color: "#2563EB" },
  };
  const info = labels[prompt.actionType!] ?? labels["mafia-kill"];

  return (
    <div>
      <div
        className="w-10 h-10 rounded-lg mx-auto mb-4 flex items-center justify-center text-lg font-black"
        style={{ backgroundColor: `${info.color}20`, color: info.color }}
      >
        {info.symbol}
      </div>
      <h3 className="text-lg font-black uppercase tracking-wider mb-1" style={{ color: info.color }}>
        {info.title}
      </h3>
      <p className="text-muted text-xs mb-6">Select a player</p>

      {detectiveResult && (
        <div className="mb-4 p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 text-xs">
            Previous: <strong>{detectiveResult.playerName}</strong> is{" "}
            <strong>{detectiveResult.isMafia ? "MAFIA" : "NOT Mafia"}</strong>
          </p>
        </div>
      )}

      <div className="space-y-2">
        {prompt.targets?.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="w-full py-4 px-5 bg-bg-card hover:bg-bg-hover border border-white/10 rounded-lg text-left text-sm font-medium transition-all active:scale-[0.98]"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadScreen() {
  return (
    <div className="text-center">
      <div className="w-3 h-3 rounded-full bg-accent-red/50 mx-auto mb-6" />
      <h3 className="text-lg font-bold text-muted mb-2 uppercase tracking-wider">You Are Dead</h3>
      <p className="text-muted text-xs">Watch in silence.</p>
    </div>
  );
}

function DeadBadge() {
  return (
    <div className="mt-4 inline-block px-4 py-1.5 bg-accent-red/10 border border-accent-red/20 rounded text-accent-red text-xs uppercase tracking-wider font-bold">
      Eliminated
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center"><div className="animate-pulse text-muted text-sm">Loading...</div></div>}>
      <PlayerPageInner />
    </Suspense>
  );
}
