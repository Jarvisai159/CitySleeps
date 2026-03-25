-- ═══════════════════════════════════════════════════════════
-- CitySleeps Migration: Game Sessions & Analytics
-- Run this in the Supabase SQL Editor AFTER the initial schema
-- ═══════════════════════════════════════════════════════════

-- ─── Add game_mode to existing games table ─────────────────
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'classic';

-- ─── Game Sessions (tracks ALL opens, starts, completions) ──
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT,
  game_mode TEXT NOT NULL DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'started', 'completed')),
  player_count INT NOT NULL DEFAULT 0,
  timezone TEXT,
  country TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode ON game_sessions(game_mode);

-- ─── RLS for game_sessions ─────────────────────────────────
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game sessions readable by all" ON game_sessions
  FOR SELECT USING (true);

CREATE POLICY "Game sessions insertable by anyone" ON game_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Game sessions updatable by anyone" ON game_sessions
  FOR UPDATE USING (true);

-- ─── Updated Admin Stats RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'new_users_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'),
    'total_games', (SELECT COUNT(*) FROM games),
    'games_7d', (SELECT COUNT(*) FROM games WHERE created_at > now() - interval '7 days'),
    'games_30d', (SELECT COUNT(*) FROM games WHERE created_at > now() - interval '30 days'),
    'active_users_7d', (SELECT COUNT(DISTINCT user_id) FROM game_players WHERE created_at > now() - interval '7 days'),
    'active_users_30d', (SELECT COUNT(DISTINCT user_id) FROM game_players WHERE created_at > now() - interval '30 days'),
    'avg_rating', (SELECT ROUND(AVG(rating)::numeric, 1) FROM profiles WHERE games_played > 0),
    'avg_players_per_game', (SELECT ROUND(AVG(player_count)::numeric, 1) FROM games),
    'mafia_win_rate', (SELECT ROUND(
      CASE WHEN COUNT(*) > 0
        THEN COUNT(*) FILTER (WHERE winner = 'MAFIA')::numeric / COUNT(*)::numeric * 100
        ELSE 0
      END, 1
    ) FROM games),
    -- New: game mode stats
    'classic_games', (SELECT COUNT(*) FROM games WHERE game_mode = 'classic'),
    'dhurandhar_games', (SELECT COUNT(*) FROM games WHERE game_mode = 'dhurandhar'),
    -- New: session funnel stats
    'total_sessions', (SELECT COUNT(*) FROM game_sessions),
    'sessions_opened_only', (SELECT COUNT(*) FROM game_sessions WHERE status = 'opened'),
    'sessions_started', (SELECT COUNT(*) FROM game_sessions WHERE status IN ('started', 'completed')),
    'sessions_completed', (SELECT COUNT(*) FROM game_sessions WHERE status = 'completed'),
    'sessions_abandoned', (SELECT COUNT(*) FROM game_sessions WHERE status = 'started'),
    -- New: 7d session stats
    'sessions_7d', (SELECT COUNT(*) FROM game_sessions WHERE created_at > now() - interval '7 days'),
    'sessions_opened_only_7d', (SELECT COUNT(*) FROM game_sessions WHERE status = 'opened' AND created_at > now() - interval '7 days'),
    'sessions_started_7d', (SELECT COUNT(*) FROM game_sessions WHERE status IN ('started', 'completed') AND created_at > now() - interval '7 days'),
    'sessions_completed_7d', (SELECT COUNT(*) FROM game_sessions WHERE status = 'completed' AND created_at > now() - interval '7 days')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
