"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { GameEngine } from "@/engine/GameEngine";
import { GameState, PublicPlayer } from "@/engine/types";
import { useGameTheme } from "@/lib/ThemeProvider";
import { ModeToggle } from "@/components/ModeToggle";
import { saveGameResult } from "@/lib/saveGame";
import {
  getSupabase,
  getPublicChannel,
  getHostChannel,
  getPlayerChannel,
} from "@/lib/supabase";
import { generateRoomCode } from "@/lib/utils";
import {
  speak,
  stopSpeech,
  playNightChime,
  playDawnChime,
  playEliminationSound,
  playVictorySound,
  setVoiceType,
  unlockAudio,
  type VoiceType,
} from "@/lib/sounds";

type GameSpeed = "rapid" | "moderate" | "slow";
const SPEED_SETTINGS: Record<GameSpeed, { discussion: number; voting: number; label: string }> = {
  rapid: { discussion: 120, voting: 45, label: "Rapid" },
  moderate: { discussion: 300, voting: 90, label: "Moderate" },
  slow: { discussion: 600, voting: 120, label: "Slow" },
};

export default function HostPage() {
  const { theme, mode, setMode, classicGamesPlayed, incrementClassicGames } = useGameTheme();
  const r = theme.roles;

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>("rapid");
  const [voiceChoice, setVoiceChoice] = useState<VoiceType>("male");
  const [showDhurandharPromo, setShowDhurandharPromo] = useState(false);
  const [showPostGamePromo, setShowPostGamePromo] = useState(false);
  const engineRef = useRef<GameEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerChannelsRef = useRef<Map<string, any>>(new Map());

  // Show first-time Dhurandhar promo
  useEffect(() => {
    if (mode === "classic" && !localStorage.getItem("citysleeps-dhurandhar-promo-seen")) {
      const t = setTimeout(() => setShowDhurandharPromo(true), 1500);
      return () => clearTimeout(t);
    }
  }, [mode]);

  // Create room
  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const sb = getSupabase();

    // Subscribe to public channel FIRST, then use it for broadcasting
    const publicCh = sb.channel(getPublicChannel(code)).subscribe();

    const engine = new GameEngine(
      (state) => {
        setGameState(state);
        publicCh.send({
          type: "broadcast",
          event: "game-state",
          payload: state,
        });
      },
      (playerId, msg) => {
        // Use pre-subscribed player channel
        const pCh = playerChannelsRef.current.get(playerId);
        if (pCh) {
          pCh.send({
            type: "broadcast",
            event: "private-msg",
            payload: msg,
          });
        } else {
          console.warn("No channel for player", playerId);
        }
      }
    );
    engineRef.current = engine;

    const hostCh = sb
      .channel(getHostChannel(code))
      .on("broadcast", { event: "player-action" }, ({ payload }) => {
        const action = payload as {
          type: string;
          playerId: string;
          playerName?: string;
          targetId?: string;
        };
        const eng = engineRef.current;
        if (!eng) return;

        try {
          if (action.type === "join" && action.playerName) {
            // Subscribe to player's private channel BEFORE adding them
            if (!playerChannelsRef.current.has(action.playerId)) {
              const pCh = sb
                .channel(getPlayerChannel(code, action.playerId))
                .subscribe((status) => {
                  if (status === "SUBSCRIBED") {
                    // Now safe to add the player (which broadcasts state)
                    try {
                      eng.addPlayer(action.playerId, action.playerName!);
                    } catch (err: unknown) {
                      console.error("Add player error:", err);
                    }
                  }
                });
              playerChannelsRef.current.set(action.playerId, pCh);
              channelsRef.current.push(pCh);
            } else {
              // Channel already exists — player reconnecting
              eng.addPlayer(action.playerId, action.playerName);
            }
          } else if (action.type === "night-action" && action.targetId) {
            eng.submitNightAction(action.playerId, action.targetId);
          } else if (action.type === "vote" && action.targetId) {
            eng.submitVote(action.playerId, action.targetId);
          } else if (action.type === "leave") {
            eng.removePlayer(action.playerId);
          }
        } catch (err: unknown) {
          console.error("Action error:", err);
        }
      })
      .subscribe();

    channelsRef.current = [publicCh, hostCh];
    setGameState(engine.getGameState());
  }, []);

  // Auto-create room on mount
  useEffect(() => {
    try {
      createRoom();
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : "Failed to initialize");
    }
    return () => {
      stopSpeech();
      try {
        channelsRef.current.forEach((ch) => getSupabase().removeChannel(ch));
      } catch {
        // not initialized
      }
      playerChannelsRef.current.clear();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Voice narration on phase changes (uses theme) ─────
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const curr = gameState.phase;
    prevPhaseRef.current = curr;
    if (prev === curr) return;

    const n = theme.narration;

    switch (curr) {
      case "ROLE_REVEAL":
        speak(n.roleReveal);
        break;
      case "NIGHT_MAFIA":
        playNightChime();
        setTimeout(() => {
          speak(gameState.round === 1 ? n.nightFirst : n.nightRepeat);
        }, 800);
        break;
      case "NIGHT_HEALER":
        speak(n.healerPrompt);
        break;
      case "NIGHT_DETECTIVE":
        speak(n.detectivePrompt);
        break;
      case "DAWN":
        playDawnChime();
        setTimeout(() => {
          if (gameState.nightResult?.killed) {
            speak(n.dawnKilled(gameState.nightResult.killedPlayerName!));
          } else if (gameState.nightResult?.savedByHealer) {
            speak(n.dawnSaved);
          } else {
            speak(n.dawnPeaceful);
          }
        }, 800);
        break;
      case "DAY_DISCUSSION":
        speak(n.discussion);
        break;
      case "DAY_VOTING":
        speak(n.vote);
        break;
      case "ELIMINATION":
        playEliminationSound();
        setTimeout(() => {
          if (gameState.voteResult?.eliminated) {
            const roleName = r[gameState.voteResult.eliminatedRole!]?.name ?? "Unknown";
            let msg = n.eliminated(gameState.voteResult.eliminatedName!, roleName);
            if (gameState.voteResult.terroristVictimName) {
              msg += " " + n.terroristRevenge(gameState.voteResult.terroristVictimName);
            }
            speak(msg);
          } else if (gameState.voteResult?.isTie) {
            speak("The vote is tied. No one is eliminated.");
          } else {
            speak("No majority was reached. No one is eliminated.");
          }
        }, 600);
        break;
      case "GAME_OVER":
        playVictorySound();
        setTimeout(() => {
          speak(
            gameState.winner === "CITY" ? n.gameOverGood : n.gameOverEvil
          );
        }, 800);
        // Save game result to database
        if (engineRef.current && roomCode) {
          saveGameResult(engineRef.current, roomCode).catch(console.error);
        }
        // Track classic games and show Dhurandhar promo
        if (mode === "classic") {
          incrementClassicGames();
          setTimeout(() => setShowPostGamePromo(true), 3000);
        }
        break;
    }
  }, [gameState?.phase]);

  // ─── Timer ────────────────────────────────────────────
  const startTimer = useCallback((seconds: number, onComplete: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(seconds);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          onComplete();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimer(null);
  }, []);

  // ─── Host Actions ─────────────────────────────────────
  const handleStartGame = () => {
    try {
      // Unlock audio/speech on user gesture (required by browsers)
      unlockAudio();
      // Apply speed settings to the engine
      if (engineRef.current) {
        const speed = SPEED_SETTINGS[gameSpeed];
        engineRef.current.settings.discussionTime = speed.discussion;
        engineRef.current.settings.votingTime = speed.voting;
      }
      // Apply voice choice
      setVoiceType(voiceChoice);
      engineRef.current?.startGame();
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  };

  const handleProceedFromRoles = () => engineRef.current?.startNight();

  const handleProceedToDayDiscussion = () => {
    engineRef.current?.startDayDiscussion();
    startTimer(engineRef.current?.settings.discussionTime ?? 120, () => {
      engineRef.current?.startVoting();
    });
  };

  const handleSkipToVoting = () => {
    stopTimer();
    engineRef.current?.startVoting();
    startTimer(engineRef.current?.settings.votingTime ?? 60, () => {
      engineRef.current?.forceResolveCurrentPhase();
    });
  };

  const handleForceResolve = () => {
    stopTimer();
    engineRef.current?.forceResolveCurrentPhase();
  };

  const handleNextRound = () => engineRef.current?.proceedAfterElimination();

  const handlePlayAgain = () => {
    stopSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(null);
    setError(null);
    setShowPostGamePromo(false);
    engineRef.current?.resetToLobby();
  };

  const handleNewGame = () => {
    stopSpeech();
    try {
      channelsRef.current.forEach((ch) => getSupabase().removeChannel(ch));
    } catch { /* */ }
    if (timerRef.current) clearInterval(timerRef.current);
    channelsRef.current = [];
    playerChannelsRef.current.clear();
    engineRef.current = null;
    setGameState(null);
    setTimer(null);
    setError(null);
    setRoomCode(null);
    setTimeout(createRoom, 100);
  };

  // ─── Setup Error ──────────────────────────────────────
  if (setupError) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold mb-4 text-accent-red uppercase tracking-wider">
            Setup Required
          </h2>
          <p className="text-muted-light mb-6 text-sm">
            This app needs a free Supabase project for real-time communication.
          </p>
          <div className="bg-bg-card border border-white/10 rounded-lg p-5 text-left text-sm space-y-3 mb-6">
            <p className="text-white/80"><span className="text-accent-red font-bold">1.</span> Go to supabase.com — create a free project</p>
            <p className="text-white/80"><span className="text-accent-red font-bold">2.</span> Settings &rarr; API Keys</p>
            <p className="text-white/80"><span className="text-accent-red font-bold">3.</span> Add env vars in Vercel:</p>
            <div className="bg-bg-primary rounded p-3 font-mono text-xs text-muted-light space-y-1">
              <p>NEXT_PUBLIC_SUPABASE_URL</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
            </div>
            <p className="text-white/80"><span className="text-accent-red font-bold">4.</span> Redeploy</p>
          </div>
          <p className="text-muted text-xs">{setupError}</p>
        </div>
      </main>
    );
  }

  if (!roomCode || !gameState) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-muted text-sm uppercase tracking-widest">Creating room...</div>
      </div>
    );
  }

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play?code=${roomCode}` : "";
  const aliveCount = gameState.players.filter((p) => p.isAlive).length;

  const shareText = theme.shareText(roomCode, joinUrl);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl).catch(() => {});
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${theme.brand.first}${theme.brand.second}`, text: shareText, url: joinUrl });
      } catch { /* cancelled */ }
    } else {
      window.open(whatsappUrl, "_blank");
    }
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background atmospherics */}
      <div className="absolute inset-0 pointer-events-none">
        {gameState.phase.startsWith("NIGHT") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-gradient-to-b from-blue-950/10 via-transparent to-transparent" />
        )}
        {(gameState.phase === "DAWN" || gameState.phase === "DAY_DISCUSSION" || gameState.phase === "DAY_VOTING") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-gradient-to-b from-amber-950/5 via-transparent to-transparent" />
        )}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent-darkred/5 blur-[150px] rounded-full" />
      </div>

      {/* ─── First-time Dhurandhar promo popup ─── */}
      <AnimatePresence>
        {showDhurandharPromo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => {
              setShowDhurandharPromo(false);
              localStorage.setItem("citysleeps-dhurandhar-promo-seen", "1");
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-bg-card border border-[#FF9933]/30 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="inline-block px-3 py-1 bg-[#FF9933]/15 border border-[#FF9933]/30 rounded-full mb-4">
                <span className="text-[#FF9933] text-[10px] font-bold uppercase tracking-widest">Limited Time</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-wider mb-2">
                <span className="text-white">Try </span>
                <span className="text-accent-red">Dhurandhar</span>
                <span className="text-white"> Mode</span>
              </h3>
              <p className="text-muted-light text-xs leading-relaxed mb-5">
                Play as characters from the blockbuster movie! ISI Agents, Ajmal Kasab, Hamza Ali Mazari and more. Same game, epic new twist.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMode("dhurandhar");
                    setShowDhurandharPromo(false);
                    localStorage.setItem("citysleeps-dhurandhar-promo-seen", "1");
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#FF9933] to-[#e6852e] hover:from-[#e6852e] hover:to-[#cc7528] text-black text-sm font-bold uppercase tracking-widest rounded-lg transition-all"
                >
                  Switch to Dhurandhar Mode
                </button>
                <button
                  onClick={() => {
                    setShowDhurandharPromo(false);
                    localStorage.setItem("citysleeps-dhurandhar-promo-seen", "1");
                  }}
                  className="w-full py-2.5 text-muted text-xs uppercase tracking-wider hover:text-white/60 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Post-game Dhurandhar promo (after classic game) ─── */}
      <AnimatePresence>
        {showPostGamePromo && mode === "classic" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowPostGamePromo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-bg-card border border-[#FF9933]/30 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
            >
              <p className="text-[#FF9933] text-3xl mb-3">🎬</p>
              <h3 className="text-lg font-black uppercase tracking-wider mb-2">
                {classicGamesPlayed >= 2
                  ? "You\u2019re a pro now!"
                  : "Great game!"}
              </h3>
              <p className="text-muted-light text-xs leading-relaxed mb-5">
                {classicGamesPlayed >= 2
                  ? "You\u2019ve played multiple rounds — now experience it with your favourite movie characters! Try Dhurandhar Mode inspired by the blockbuster film. Available for a limited time only."
                  : "Want to play as characters from the hit movie Dhurandhar? ISI Agents vs India\u2019s finest. Same rules, cinematic twist. Available for a limited time!"}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMode("dhurandhar");
                    setShowPostGamePromo(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#FF9933] to-[#e6852e] hover:from-[#e6852e] hover:to-[#cc7528] text-black text-sm font-bold uppercase tracking-widest rounded-lg transition-all"
                >
                  Try Dhurandhar Mode
                </button>
                <button
                  onClick={() => setShowPostGamePromo(false)}
                  className="w-full py-2.5 text-muted text-xs uppercase tracking-wider hover:text-white/60 transition-colors"
                >
                  Continue Classic
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode toggle - top left */}
      {gameState.phase === "LOBBY" && (
        <div className="fixed top-4 left-4 z-50">
          <ModeToggle />
        </div>
      )}

      {/* ─── Persistent QR sidebar (visible during game, not lobby) ─── */}
      {gameState.phase !== "LOBBY" && (
        <div className="fixed top-4 right-4 z-50 bg-bg-card/90 backdrop-blur border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 shadow-lg">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={joinUrl} size={80} level="M" bgColor="#ffffff" fgColor="#0d0d0d" />
          </div>
          <p className="text-white text-xs font-black tracking-wider">{roomCode}</p>
          <p className="text-muted text-[9px] uppercase tracking-widest">Scan to join</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ─── LOBBY ───────────────────────────────── */}
        {gameState.phase === "LOBBY" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 w-full max-w-2xl text-center">
            <h2 className="text-3xl font-black uppercase tracking-wider mb-1">
              <span className={theme.brand.accentSecond ? "text-white" : "text-accent-red"}>{theme.brand.first}</span>
              <span className={theme.brand.accentSecond ? "text-accent-red" : "text-white"}>{theme.brand.second}</span>
            </h2>
            <p className="text-muted text-sm uppercase tracking-[0.3em] mb-2">Room Code</p>
            <h2 className="text-6xl font-black tracking-[0.15em] text-white mb-4">{roomCode}</h2>

            <div className="flex gap-2 justify-center mb-8">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <button
                onClick={handleCopyLink}
                className="py-2 px-4 bg-bg-elevated hover:bg-bg-hover text-white/80 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-white/10"
              >
                Copy Link
              </button>
              <button
                onClick={handleShare}
                className="py-2 px-4 bg-bg-elevated hover:bg-bg-hover text-white/80 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-white/10"
              >
                Share
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-10 items-center justify-center mb-10">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG value={joinUrl} size={220} level="M" bgColor="#ffffff" fgColor="#0d0d0d" />
              </div>

              <div className="flex-1 min-w-[240px] text-left">
                <p className="text-muted text-sm uppercase tracking-[0.2em] mb-4">
                  Players &mdash; {gameState.players.length}
                </p>
                <div className="space-y-2">
                  {gameState.players.length === 0 && (
                    <p className="text-muted text-base">Waiting for players...</p>
                  )}
                  {gameState.players.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-bg-card border border-white/5 rounded-lg px-4 py-3"
                    >
                      <div className="w-8 h-8 rounded bg-accent-red/20 text-accent-red flex items-center justify-center text-sm font-bold uppercase">
                        {p.name[0]}
                      </div>
                      <span className="text-base font-medium text-white/90">{p.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Game Settings */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
              {/* Game Speed */}
              <div>
                <p className="text-muted text-xs uppercase tracking-widest mb-3 text-center">Game Speed</p>
                <div className="flex gap-2">
                  {(["rapid", "moderate", "slow"] as GameSpeed[]).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setGameSpeed(speed)}
                      className={`py-2.5 px-4 rounded-lg transition-colors border text-center ${
                        gameSpeed === speed
                          ? "bg-accent-red/20 border-accent-red/50 text-accent-red"
                          : "bg-bg-card border-white/5 text-muted hover:text-white/70"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider block">{SPEED_SETTINGS[speed].label}</span>
                      <span className={`text-[10px] block mt-0.5 ${gameSpeed === speed ? "text-accent-red/70" : "text-muted/60"}`}>
                        {speed === "rapid" ? "2 min discuss · 45s vote" : speed === "moderate" ? "5 min discuss · 90s vote" : "10 min discuss · 2 min vote"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Selection */}
              <div>
                <p className="text-muted text-xs uppercase tracking-widest mb-3 text-center">Narrator Voice</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoiceChoice("male")}
                    className={`py-2.5 px-5 rounded-lg transition-colors border text-center ${
                      voiceChoice === "male"
                        ? "bg-accent-red/20 border-accent-red/50 text-accent-red"
                        : "bg-bg-card border-white/5 text-muted hover:text-white/70"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block">Male</span>
                    <span className={`text-[10px] block mt-0.5 ${voiceChoice === "male" ? "text-accent-red/70" : "text-muted/60"}`}>Deep &amp; commanding</span>
                  </button>
                  <button
                    onClick={() => setVoiceChoice("female")}
                    className={`py-2.5 px-5 rounded-lg transition-colors border text-center ${
                      voiceChoice === "female"
                        ? "bg-accent-red/20 border-accent-red/50 text-accent-red"
                        : "bg-bg-card border-white/5 text-muted hover:text-white/70"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block">Female</span>
                    <span className={`text-[10px] block mt-0.5 ${voiceChoice === "female" ? "text-accent-red/70" : "text-muted/60"}`}>Smooth &amp; relaxed</span>
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-accent-red text-sm mb-4">{error}</p>}

            <button
              onClick={handleStartGame}
              disabled={gameState.players.length < 4}
              className="py-3.5 px-14 bg-accent-red hover:bg-accent-crimson disabled:bg-bg-elevated disabled:text-muted text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors"
            >
              {gameState.players.length < 4
                ? `Need ${4 - gameState.players.length} more`
                : "Start Game"}
            </button>
          </motion.div>
        )}

        {/* ─── ROLE REVEAL ─────────────────────────── */}
        {gameState.phase === "ROLE_REVEAL" && (
          <motion.div key="role-reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
            <div className="w-12 h-px bg-accent-red mx-auto mb-8" />
            <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Roles Assigned</h2>
            <p className="text-muted-light text-sm mb-10">Check your phones. Do not show anyone.</p>
            <button onClick={handleProceedFromRoles} className="py-3.5 px-14 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
              Begin Night 1
            </button>
          </motion.div>
        )}

        {/* ─── NIGHT ───────────────────────────────── */}
        {(gameState.phase === "NIGHT_MAFIA" || gameState.phase === "NIGHT_HEALER" || gameState.phase === "NIGHT_DETECTIVE") && (
          <motion.div key="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-blue-400 mx-auto mb-8"
            />
            <h2 className="text-4xl font-black uppercase tracking-wider mb-2">Night {gameState.round}</h2>
            <p className="text-muted text-sm uppercase tracking-widest mb-2">Everyone close your eyes</p>
            <motion.p
              key={gameState.phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-light text-sm mb-10"
            >
              {gameState.phase === "NIGHT_MAFIA" && `${r.MAFIA.name} is choosing a target... ${r.SPY.name} is watching.`}
              {gameState.phase === "NIGHT_HEALER" && `${r.HEALER.name} is choosing who to save...`}
              {gameState.phase === "NIGHT_DETECTIVE" && `${r.DETECTIVE.name} is investigating...`}
            </motion.p>
            <button onClick={handleForceResolve} className="py-2.5 px-8 bg-bg-elevated hover:bg-bg-hover text-muted-light text-xs uppercase tracking-widest rounded-lg transition-colors border border-white/5">
              Force Advance
            </button>
          </motion.div>
        )}

        {/* ─── DAWN ────────────────────────────────── */}
        {gameState.phase === "DAWN" && (
          <motion.div key="dawn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }}>
              <div className="w-3 h-3 rounded-full bg-amber-400 mx-auto mb-8" />
              <h2 className="text-3xl font-black uppercase tracking-wider mb-6">Dawn Breaks</h2>

              {gameState.nightResult?.killed ? (
                <div className="bg-bg-card border border-accent-red/30 rounded-lg p-6 max-w-sm mx-auto mb-8">
                  <p className="text-accent-red text-xl font-bold uppercase tracking-wide mb-1">
                    {gameState.nightResult.killedPlayerName}
                  </p>
                  <p className="text-muted-light text-sm">was eliminated by {r.MAFIA.name}</p>
                </div>
              ) : gameState.nightResult?.savedByHealer ? (
                <div className="bg-bg-card border border-green-700/30 rounded-lg p-6 max-w-sm mx-auto mb-8">
                  <p className="text-green-500 text-xl font-bold uppercase tracking-wide mb-1">No One Died</p>
                  <p className="text-muted-light text-sm">{r.HEALER.name} made a save</p>
                </div>
              ) : (
                <div className="bg-bg-card border border-white/10 rounded-lg p-6 max-w-sm mx-auto mb-8">
                  <p className="text-white/70 text-xl font-bold uppercase tracking-wide mb-1">Peaceful Night</p>
                  <p className="text-muted-light text-sm">No one was harmed</p>
                </div>
              )}

              {!gameState.winner && (
                <button onClick={handleProceedToDayDiscussion} className="py-3.5 px-14 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
                  Start Discussion
                </button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ─── DAY DISCUSSION ──────────────────────── */}
        {gameState.phase === "DAY_DISCUSSION" && (
          <motion.div key="discussion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center w-full max-w-md">
            <h2 className="text-3xl font-black uppercase tracking-wider mb-2">Discussion</h2>
            <p className="text-muted text-sm mb-6">Debate who might be {r.MAFIA.name}</p>

            {timer !== null && (
              <div className="text-5xl font-black tabular-nums text-white/90 mb-6">
                {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
              </div>
            )}

            <PlayerStatusList players={gameState.players} />

            <button onClick={handleSkipToVoting} className="mt-8 py-3.5 px-14 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
              Skip to Voting
            </button>
          </motion.div>
        )}

        {/* ─── DAY VOTING ──────────────────────────── */}
        {gameState.phase === "DAY_VOTING" && (
          <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center w-full max-w-md">
            <h2 className="text-3xl font-black uppercase tracking-wider mb-2">Vote Now</h2>
            <p className="text-muted text-sm mb-6">Cast your vote on your phone</p>

            {timer !== null && (
              <div className="text-4xl font-black tabular-nums text-white/90 mb-4">
                {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
              </div>
            )}

            <div className="space-y-1.5 mb-6">
              {gameState.players.filter((p) => p.isAlive).map((p) => {
                const votes = gameState.voteTally?.[p.id] ?? 0;
                const pct = aliveCount > 0 ? (votes / aliveCount) * 100 : 0;
                return (
                  <div key={p.id} className="relative bg-bg-card border border-white/5 rounded-lg px-4 py-3 overflow-hidden">
                    {votes > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className="absolute inset-y-0 left-0 bg-accent-red/15"
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <span className="text-sm font-medium">{p.name}</span>
                      {votes > 0 && <span className="text-accent-red text-sm font-bold">{votes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-muted text-xs uppercase tracking-wider mb-6">
              {Object.keys(gameState.votes ?? {}).length} / {aliveCount} voted
            </p>

            <button onClick={handleForceResolve} className="py-2.5 px-8 bg-bg-elevated hover:bg-bg-hover text-muted-light text-xs uppercase tracking-widest rounded-lg transition-colors border border-white/5">
              Force End Vote
            </button>
          </motion.div>
        )}

        {/* ─── ELIMINATION ─────────────────────────── */}
        {gameState.phase === "ELIMINATION" && (
          <motion.div key="elimination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center">
            {gameState.voteResult?.eliminated ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
                <div className="w-12 h-px bg-accent-red mx-auto mb-8" />
                <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Eliminated</h2>
                <div className="bg-bg-card border border-accent-red/30 rounded-lg p-6 max-w-sm mx-auto mb-2">
                  <p className="text-white text-2xl font-black uppercase tracking-wide mb-1">
                    {gameState.voteResult.eliminatedName}
                  </p>
                  <p className="text-sm font-bold uppercase tracking-wider" style={{ color: r[gameState.voteResult.eliminatedRole!]?.color }}>
                    {r[gameState.voteResult.eliminatedRole!]?.name}
                  </p>
                </div>
                {gameState.voteResult.terroristVictimName && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                    className="bg-bg-card border border-orange-500/30 rounded-lg p-5 max-w-sm mx-auto mt-4">
                    <p className="text-orange-400 text-xs uppercase tracking-wider font-bold mb-1">{r.TERRORIST.name}&apos;s Final Act</p>
                    <p className="text-white text-lg font-black uppercase">{gameState.voteResult.terroristVictimName}</p>
                    <p className="text-muted-light text-xs mt-1">was taken down as well</p>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="w-12 h-px bg-white/20 mx-auto mb-8" />
                <h2 className="text-2xl font-black uppercase tracking-wider mb-2">
                  {gameState.voteResult?.isTie ? "Tied Vote" : "No Majority"}
                </h2>
                <p className="text-muted-light text-sm mb-2">No one was eliminated</p>
              </motion.div>
            )}

            {!gameState.winner && (
              <button onClick={handleNextRound} className="mt-8 py-3.5 px-14 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
                Continue to Night
              </button>
            )}
          </motion.div>
        )}

        {/* ─── GAME OVER ──────────────────────────── */}
        {gameState.phase === "GAME_OVER" && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 text-center w-full max-w-md">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: "spring" }}>
              <div className="w-16 h-px bg-accent-red mx-auto mb-8" />
              <p className="text-muted text-xs uppercase tracking-[0.3em] mb-3">Game Over</p>
              <h2 className="text-4xl font-black uppercase tracking-wider mb-2">
                {gameState.winner === "CITY" ? (
                  <span className="text-white">{theme.win.goodTitle}</span>
                ) : (
                  <span className="text-accent-red">{theme.win.evilTitle}</span>
                )}
              </h2>
              <p className="text-muted-light text-sm mb-10">
                {gameState.winner === "CITY" ? theme.win.goodDesc : theme.win.evilDesc}
              </p>
            </motion.div>

            <div className="space-y-1.5 mb-10">
              <p className="text-muted text-xs uppercase tracking-[0.2em] mb-3">All Roles</p>
              {gameState.players.map((p) => {
                const role = gameState.allRoles?.[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between bg-bg-card border border-white/5 rounded-lg px-4 py-3">
                    <span className={p.isAlive ? "text-sm font-medium" : "text-sm font-medium line-through text-muted"}>
                      {p.name}
                    </span>
                    {role && (
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: r[role].color }}>
                        {r[role].name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handlePlayAgain} className="py-3.5 px-14 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
                Play Again
              </button>
              <button onClick={handleNewGame} className="py-3.5 px-10 bg-bg-elevated hover:bg-bg-hover text-muted-light text-sm font-bold uppercase tracking-widest rounded-lg transition-colors border border-white/10">
                New Room
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function PlayerStatusList({ players }: { players: PublicPlayer[] }) {
  return (
    <div className="space-y-1.5">
      {players.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
            p.isAlive ? "bg-bg-card border border-white/5" : "bg-bg-card/50 border border-white/[0.02]"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${p.isAlive ? "bg-green-500" : "bg-accent-red"}`} />
          <span className={p.isAlive ? "text-sm font-medium" : "text-sm font-medium line-through text-muted"}>
            {p.name}
          </span>
          {!p.isAlive && <span className="text-muted text-xs ml-auto uppercase tracking-wider">Dead</span>}
        </div>
      ))}
    </div>
  );
}
