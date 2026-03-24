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
}

interface RecentGame {
  id: string;
  room_code: string;
  winner: string;
  total_rounds: number;
  player_count: number;
  created_at: string;
}

interface TopPlayer {
  id: string;
  display_name: string;
  rating: number;
  games_played: number;
  games_won: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Simple password auth for admin (can be upgraded to Supabase Auth later)
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
        });
      } else {
        setStats(statsData as DashboardStats);
      }

      // Fetch recent games
      const { data: games } = await sb
        .from("games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setRecentGames(games ?? []);

      // Fetch top players
      const { data: players } = await sb
        .from("profiles")
        .select("id, display_name, rating, games_played, games_won")
        .gt("games_played", 0)
        .order("rating", { ascending: false })
        .limit(20);
      setTopPlayers(players ?? []);

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
    <main className="min-h-dvh px-6 py-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">
            <span className="text-accent-red">City</span>Sleeps Admin
          </h1>
          <p className="text-muted text-xs uppercase tracking-widest mt-1">Dashboard</p>
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
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
              <StatCard label="Total Users" value={stats.total_users} />
              <StatCard label="New Users (7d)" value={stats.new_users_7d} />
              <StatCard label="New Users (30d)" value={stats.new_users_30d} />
              <StatCard label="Active Users (7d)" value={stats.active_users_7d} />
              <StatCard label="Total Games" value={stats.total_games} />
              <StatCard label="Games (7d)" value={stats.games_7d} />
              <StatCard label="Games (30d)" value={stats.games_30d} />
              <StatCard label="Active Users (30d)" value={stats.active_users_30d} />
              <StatCard label="Avg Rating" value={stats.avg_rating ?? "—"} />
              <StatCard label="Avg Players/Game" value={stats.avg_players_per_game ?? "—"} />
              <StatCard label="Mafia Win Rate" value={stats.mafia_win_rate !== null ? `${stats.mafia_win_rate}%` : "—"} />
              <StatCard label="City Win Rate" value={stats.mafia_win_rate !== null ? `${(100 - stats.mafia_win_rate).toFixed(1)}%` : "—"} />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Top Players */}
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-4 flex items-center gap-2">
                <div className="w-4 h-px bg-accent-red" />
                Top Players
              </h2>
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

            {/* Recent Games */}
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-4 flex items-center gap-2">
                <div className="w-4 h-px bg-accent-red" />
                Recent Games
              </h2>
              <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden">
                {recentGames.length === 0 ? (
                  <p className="text-muted text-xs p-6 text-center">No games recorded yet</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                        <th className="text-left p-3">Room</th>
                        <th className="text-center p-3">Winner</th>
                        <th className="text-center p-3">Rounds</th>
                        <th className="text-center p-3">Players</th>
                        <th className="text-right p-3">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentGames.map((g) => (
                        <tr key={g.id} className="border-b border-white/[0.03]">
                          <td className="p-3 font-mono text-white">{g.room_code}</td>
                          <td className="p-3 text-center">
                            <span className={g.winner === "MAFIA" ? "text-accent-red font-bold" : "text-green-500 font-bold"}>
                              {g.winner === "MAFIA" ? "Mafia" : "City"}
                            </span>
                          </td>
                          <td className="p-3 text-center text-muted-light">{g.total_rounds}</td>
                          <td className="p-3 text-center text-muted-light">{g.player_count}</td>
                          <td className="p-3 text-right text-muted">{formatTimeAgo(g.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-card border border-white/5 rounded-lg p-4">
      <p className="text-muted text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white text-xl font-black">{value}</p>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
