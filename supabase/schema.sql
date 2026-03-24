-- ═══════════════════════════════════════════════════════════
-- CitySleeps Database Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── Profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  rating FLOAT NOT NULL DEFAULT 1200.0,
  games_played INT NOT NULL DEFAULT 0,
  games_won INT NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Games ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('MAFIA', 'CITY')),
  total_rounds INT NOT NULL,
  player_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Game Players ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('mafia', 'city')),
  survived BOOLEAN NOT NULL,
  survival_round INT NOT NULL,
  team_won BOOLEAN NOT NULL,
  rating_before FLOAT NOT NULL,
  rating_after FLOAT NOT NULL,
  rating_delta FLOAT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);

-- ─── RPC: Update Player Stats ────────────────────────────
CREATE OR REPLACE FUNCTION update_player_stats(
  p_user_id UUID,
  p_new_rating FLOAT,
  p_won BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    rating = p_new_rating,
    games_played = games_played + 1,
    games_won = CASE WHEN p_won THEN games_won + 1 ELSE games_won END,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Row Level Security ──────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read (leaderboard), users update own
CREATE POLICY "Profiles readable by all" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Games: anyone can read, anon or authenticated can insert
CREATE POLICY "Games readable by all" ON games
  FOR SELECT USING (true);

CREATE POLICY "Games insertable by anyone" ON games
  FOR INSERT WITH CHECK (true);

-- Game players: anyone can read, anon or authenticated can insert
CREATE POLICY "Game players readable" ON game_players
  FOR SELECT USING (true);

CREATE POLICY "Game players insertable" ON game_players
  FOR INSERT WITH CHECK (true);

-- Profiles insertable by trigger (SECURITY DEFINER handles this)
-- Allow service role and trigger to insert profiles
CREATE POLICY "Service insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- ─── Admin RPC Functions ─────────────────────────────────

-- Get dashboard stats
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
    ) FROM games)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
