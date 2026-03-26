"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";

interface DashboardStats {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  total_games: number;
  games_7d: number;
  games_30d: number;
  active_users_7d: number;
  active_users_30d: number;
  avg_rating: number | null;
  avg_players_per_game: number | null;
  mafia_win_rate: number | null;
  classic_games: number;
  dhurandhar_games: number;
  total_sessions: number;
  sessions_opened_only: number;
  sessions_started: number;
  sessions_completed: number;
  sessions_abandoned: number;
  sessions_7d: number;
  sessions_opened_only_7d: number;
  sessions_started_7d: number;
  sessions_completed_7d: number;
}

interface RecentGame {
  id: string;
  room_code: string;
  winner: string;
  total_rounds: number;
  player_count: number;
  game_mode: string;
  created_at: string;
}

interface GameSession {
  id: string;
  room_code: string;
  game_mode: string;
  status: string;
  player_count: number;
  timezone: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface TopPlayer {
  id: string;
  display_name: string;
  rating: number;
  games_played: number;
  games_won: number;
}

interface ClientError {
  id: string;
  message: string;
  stack: string | null;
  page: string;
  user_agent: string;
  context: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  const ADMIN_PASSWORD = "citysleeps2024";

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem("cs-admin", "1");
    } else {
      setError("Invalid password");
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("cs-admin") === "1") {
      setAuthenticated(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const sb = getSupabase();

      // Fetch stats via RPC
      const { data: statsData, error: statsError } = await sb.rpc("get_admin_stats");
      if (statsError) {
        console.error("Stats error:", statsError);
        // Fallback: fetch manually
        const { count: totalUsers } = await sb.from("profiles").select("*", { count: "exact", head: true });
        const { count: totalGames } = await sb.from("games").select("*", { count: "exact", head: true });
        const { count: totalSessions } = await sb.from("game_sessions").select("*", { count: "exact", head: true });
        setStats({
          total_users: totalUsers ?? 0,
          new_users_7d: 0,
          new_users_30d: 0,
          total_games: totalGames ?? 0,
          games_7d: 0,
          games_30d: 0,
          active_users_7d: 0,
          active_users_30d: 0,
          avg_rating: null,
          avg_players_per_game: null,
          mafia_win_rate: null,
          classic_games: 0,
          dhurandhar_games: 0,
          total_sessions: totalSessions ?? 0,
          sessions_opened_only: 0,
          sessions_started: 0,
          sessions_completed: 0,
          sessions_abandoned: 0,
          sessions_7d: 0,
          sessions_opened_only_7d: 0,
          sessions_started_7d: 0,
          sessions_completed_7d: 0,
        });
      } else {
        setStats(statsData as DashboardStats);
      }

      // Fetch recent games
      const { data: games } = await sb
        .from("games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      setRecentGames(games ?? []);

      // Fetch recent sessions
      const { data: sessionsData } = await sb
        .from("game_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setSessions(sessionsData ?? []);

      // Fetch top players
      const { data: players } = await sb
        .from("profiles")
        .select("id, display_name, rating, games_played, games_won")
        .gt("games_played", 0)
        .order("rating", { ascending: false })
        .limit(20);
      setTopPlayers(players ?? []);

      // Fetch client errors
      const { data: errors } = await sb
        .from("client_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setClientErrors(errors ?? []);

      setLoading(false);
    } catch (err) {
      console.error("Admin fetch error:", err);
      setError("Failed to load data. Make sure the database tables are set up.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  if (!authenticated) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-px bg-accent-red mx-auto mb-8" />
          <h1 className="text-2xl font-black uppercase tracking-wider mb-8">Admin Dashboard</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full bg-bg-card border border-white/10 rounded-lg px-4 py-4 text-center text-lg focus:outline-none focus:border-accent-red/50 transition-colors mb-4"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          {error && <p className="text-accent-red text-sm mb-4">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors"
          >
            Login
          </button>
          <Link href="/" className="text-muted text-xs mt-6 block hover:text-white/60 transition-colors">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">
            <span className="text-accent-red">City</span>Sleeps Admin
          </h1>
          <p className="text-muted text-xs uppercase tracking-widest mt-1">Analytics Dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="py-2 px-4 bg-bg-elevated hover:bg-bg-hover text-muted-light text-xs uppercase tracking-wider rounded-lg transition-colors border border-white/5"
          >
            Refresh
          </button>
          <Link href="/">
            <button className="py-2 px-4 bg-bg-elevated hover:bg-bg-hover text-muted-light text-xs uppercase tracking-wider rounded-lg transition-colors border border-white/5">
              Home
            </button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-pulse text-muted text-sm uppercase tracking-widest">Loading...</div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-accent-red text-sm mb-4">{error}</p>
          <p className="text-muted text-xs">Run the SQL schema in your Supabase project first.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* ─── Session Funnel ─────────────────────────── */}
          {stats && (
            <>
              <SectionHeader title="Session Funnel" subtitle="How users progress through the game" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard label="Total Sessions" value={stats.total_sessions} />
                <StatCard label="Opened Only" value={stats.sessions_opened_only} accent="yellow" />
                <StatCard label="Started (not finished)" value={stats.sessions_abandoned} accent="orange" />
                <StatCard label="Completed" value={stats.sessions_completed} accent="green" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                <StatCard label="Sessions (7d)" value={stats.sessions_7d} />
                <StatCard label="Opened Only (7d)" value={stats.sessions_opened_only_7d} accent="yellow" />
                <StatCard label="Started (7d)" value={stats.sessions_started_7d} />
                <StatCard label="Completed (7d)" value={stats.sessions_completed_7d} accent="green" />
              </div>

              {/* ─── Funnel Bar ───────────────────────────── */}
              {stats.total_sessions > 0 && (
                <div className="bg-bg-card border border-white/5 rounded-lg p-5 mb-10">
                  <p className="text-[10px] text-muted uppercase tracking-widest mb-3">Conversion Funnel</p>
                  <div className="space-y-2">
                    <FunnelBar label="Opened" value={stats.total_sessions} max={stats.total_sessions} color="bg-white/20" />
                    <FunnelBar label="Started Game" value={stats.sessions_started} max={stats.total_sessions} color="bg-amber-500" />
                    <FunnelBar label="Completed Game" value={stats.sessions_completed} max={stats.total_sessions} color="bg-green-500" />
                  </div>
                  <div className="flex gap-6 mt-3 text-[10px] text-muted">
                    <span>Start Rate: <strong className="text-white">{stats.total_sessions > 0 ? ((stats.sessions_started / stats.total_sessions) * 100).toFixed(1) : 0}%</strong></span>
                    <span>Completion Rate: <strong className="text-white">{stats.sessions_started > 0 ? ((stats.sessions_completed / stats.sessions_started) * 100).toFixed(1) : 0}%</strong></span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Game Mode Split ───────────────────────── */}
          {stats && (
            <>
              <SectionHeader title="Game Mode" subtitle="Classic vs Dhurandhar" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                <StatCard label="Classic Games" value={stats.classic_games} />
                <StatCard label="Dhurandhar Games" value={stats.dhurandhar_games} accent="orange" />
                <StatCard label="Classic %" value={stats.total_games > 0 ? `${((stats.classic_games / stats.total_games) * 100).toFixed(1)}%` : "—"} />
                <StatCard label="Dhurandhar %" value={stats.total_games > 0 ? `${((stats.dhurandhar_games / stats.total_games) * 100).toFixed(1)}%` : "—"} accent="orange" />
              </div>
            </>
          )}

          {/* ─── Overview Stats ────────────────────────── */}
          {stats && (
            <>
              <SectionHeader title="Overview" subtitle="Users and games" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                <StatCard label="Total Users" value={stats.total_users} />
                <StatCard label="New Users (7d)" value={stats.new_users_7d} />
                <StatCard label="Total Games" value={stats.total_games} />
                <StatCard label="Games (7d)" value={stats.games_7d} />
                <StatCard label="Active Users (7d)" value={stats.active_users_7d} />
                <StatCard label="Active Users (30d)" value={stats.active_users_30d} />
                <StatCard label="Avg Players/Game" value={stats.avg_players_per_game ?? "—"} />
                <StatCard label="Avg Rating" value={stats.avg_rating ?? "—"} />
                <StatCard label="Mafia Win Rate" value={stats.mafia_win_rate !== null ? `${stats.mafia_win_rate}%` : "—"} accent="red" />
                <StatCard label="City Win Rate" value={stats.mafia_win_rate !== null ? `${(100 - stats.mafia_win_rate).toFixed(1)}%` : "—"} accent="green" />
              </div>
            </>
          )}

          {/* ─── Location & Sessions Table ──────────────── */}
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div>
              <SectionHeader title="Recent Sessions" subtitle="Where & when games are played" />
              <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden">
                {sessions.length === 0 ? (
                  <p className="text-muted text-xs p-6 text-center">No sessions recorded yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                          <th className="text-left p-3">Room</th>
                          <th className="text-center p-3">Mode</th>
                          <th className="text-center p-3">Status</th>
                          <th className="text-center p-3">Players</th>
                          <th className="text-left p-3">Location</th>
                          <th className="text-right p-3">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id} className="border-b border-white/[0.03]">
                            <td className="p-3 font-mono text-white">{s.room_code || "—"}</td>
                            <td className="p-3 text-center">
                              <span className={s.game_mode === "dhurandhar" ? "text-[#FF9933] font-bold" : "text-muted-light"}>
                                {s.game_mode === "dhurandhar" ? "DHR" : "Classic"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="p-3 text-center text-muted-light">{s.player_count || "—"}</td>
                            <td className="p-3 text-left text-muted-light">
                              {s.city ? `${s.city}` : s.timezone || "—"}
                            </td>
                            <td className="p-3 text-right text-muted">
                              <div>{formatDate(s.created_at)}</div>
                              <div className="text-[10px]">{formatTime(s.created_at)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Top Players ──────────────────────────── */}
            <div>
              <SectionHeader title="Top Players" subtitle="By rating" />
              <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden">
                {topPlayers.length === 0 ? (
                  <p className="text-muted text-xs p-6 text-center">No games played yet</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                        <th className="text-left p-3">#</th>
                        <th className="text-left p-3">Player</th>
                        <th className="text-center p-3">Rating</th>
                        <th className="text-center p-3">W/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPlayers.map((p, i) => (
                        <tr key={p.id} className="border-b border-white/[0.03]">
                          <td className="p-3 text-muted">{i + 1}</td>
                          <td className="p-3 text-white font-medium">{p.display_name}</td>
                          <td className="p-3 text-center text-accent-red font-bold">{Math.round(p.rating)}</td>
                          <td className="p-3 text-center text-muted-light">{p.games_won}/{p.games_played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ─── Recent Games ──────────────────────────── */}
          <SectionHeader title="Recent Games" subtitle="Completed games with results" />
          <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden mb-10">
            {recentGames.length === 0 ? (
              <p className="text-muted text-xs p-6 text-center">No games recorded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                      <th className="text-left p-3">Room</th>
                      <th className="text-center p-3">Mode</th>
                      <th className="text-center p-3">Winner</th>
                      <th className="text-center p-3">Rounds</th>
                      <th className="text-center p-3">Players</th>
                      <th className="text-right p-3">Date</th>
                      <th className="text-right p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((g) => (
                      <tr key={g.id} className="border-b border-white/[0.03]">
                        <td className="p-3 font-mono text-white">{g.room_code}</td>
                        <td className="p-3 text-center">
                          <span className={g.game_mode === "dhurandhar" ? "text-[#FF9933] font-bold" : "text-muted-light"}>
                            {g.game_mode === "dhurandhar" ? "DHR" : "Classic"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={g.winner === "MAFIA" ? "text-accent-red font-bold" : "text-green-500 font-bold"}>
                            {g.winner === "MAFIA" ? "Mafia" : "City"}
                          </span>
                        </td>
                        <td className="p-3 text-center text-muted-light">{g.total_rounds}</td>
                        <td className="p-3 text-center text-muted-light">{g.player_count}</td>
                        <td className="p-3 text-right text-muted">{formatDate(g.created_at)}</td>
                        <td className="p-3 text-right text-muted">{formatTime(g.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Location Breakdown ─────────────────────── */}
          <SectionHeader title="Locations" subtitle="Where games are being played (by timezone)" />
          <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden mb-10">
            <LocationBreakdown sessions={sessions} />
          </div>

          {/* ─── Client Errors ──────────────────────────── */}
          <SectionHeader title="Client Errors" subtitle={`Recent errors from user devices (${clientErrors.length})`} />
          <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden mb-10">
            {clientErrors.length === 0 ? (
              <p className="text-green-500 text-xs p-6 text-center">No errors reported</p>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {clientErrors.map((err) => (
                  <div key={err.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="text-accent-red text-xs font-bold flex-1 break-all">{err.message}</p>
                      <div className="text-right shrink-0">
                        <p className="text-muted text-[10px]">{formatDate(err.created_at)}</p>
                        <p className="text-muted text-[10px]">{formatTime(err.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted mb-1">
                      <span>Page: <strong className="text-muted-light">{err.page}</strong></span>
                      {err.context && <span>Context: <strong className="text-muted-light">{err.context}</strong></span>}
                    </div>
                    <p className="text-[10px] text-muted break-all line-clamp-2">{err.user_agent}</p>
                    {err.stack && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-muted cursor-pointer hover:text-white/60">Stack trace</summary>
                        <pre className="text-[9px] text-muted-light mt-1 bg-bg-primary rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {err.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </motion.div>
      )}
    </main>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
        <div className="w-4 h-px bg-accent-red" />
        {title}
      </h2>
      <p className="text-muted text-[10px] uppercase tracking-widest mt-1 pl-7">{subtitle}</p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const colorMap: Record<string, string> = {
    red: "text-accent-red",
    green: "text-green-500",
    orange: "text-[#FF9933]",
    yellow: "text-amber-400",
  };
  const textColor = accent ? colorMap[accent] || "text-white" : "text-white";
  return (
    <div className="bg-bg-card border border-white/5 rounded-lg p-4">
      <p className="text-muted text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`${textColor} text-xl font-black`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    opened: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Opened" },
    started: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Started" },
    completed: { bg: "bg-green-500/15", text: "text-green-400", label: "Completed" },
  };
  const c = config[status] || config.opened;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted uppercase tracking-wider w-28 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
        <div className={`h-full ${color} rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white font-bold w-12 text-right">{value}</span>
      <span className="text-[10px] text-muted w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function LocationBreakdown({ sessions }: { sessions: GameSession[] }) {
  // Group sessions by city/timezone
  const locationMap: Record<string, { count: number; completed: number; modes: Record<string, number> }> = {};
  for (const s of sessions) {
    const key = s.city || s.timezone || "Unknown";
    if (!locationMap[key]) locationMap[key] = { count: 0, completed: 0, modes: {} };
    locationMap[key].count++;
    if (s.status === "completed") locationMap[key].completed++;
    locationMap[key].modes[s.game_mode] = (locationMap[key].modes[s.game_mode] || 0) + 1;
  }

  const sorted = Object.entries(locationMap).sort((a, b) => b[1].count - a[1].count);

  if (sorted.length === 0) {
    return <p className="text-muted text-xs p-6 text-center">No location data yet</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
          <th className="text-left p-3">Location</th>
          <th className="text-center p-3">Sessions</th>
          <th className="text-center p-3">Completed</th>
          <th className="text-center p-3">Classic</th>
          <th className="text-center p-3">Dhurandhar</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(([loc, data]) => (
          <tr key={loc} className="border-b border-white/[0.03]">
            <td className="p-3 text-white font-medium">{loc}</td>
            <td className="p-3 text-center text-muted-light">{data.count}</td>
            <td className="p-3 text-center text-green-500 font-bold">{data.completed}</td>
            <td className="p-3 text-center text-muted-light">{data.modes["classic"] || 0}</td>
            <td className="p-3 text-center text-[#FF9933] font-bold">{data.modes["dhurandhar"] || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
