import { getSupabase } from "./supabase";
import type { GameEngine } from "@/engine/GameEngine";

export async function saveGameResult(
  engine: GameEngine,
  roomCode: string
): Promise<{ success: boolean; error?: string }> {
  const result = engine.getGameResult();
  if (!result) return { success: false, error: "Game not over" };

  // Check for authenticated players (UUID format IDs from Supabase Auth)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const authenticatedPlayers = result.players.filter((p) =>
    uuidRegex.test(p.userId)
  );

  try {
    const sb = getSupabase();

    // Always save the game record (even without authenticated players)
    const { error: gameError } = await sb
      .from("games")
      .insert({
        room_code: roomCode,
        winner: result.winner,
        total_rounds: result.totalRounds,
        player_count: result.players.length,
      });

    if (gameError) {
      console.error("Game insert error:", gameError);
      return { success: false, error: gameError.message };
    }

    // If there are authenticated players, also save per-player stats
    if (authenticatedPlayers.length > 0) {
      await savePlayerStats(sb, roomCode, result, authenticatedPlayers);
    }

    return { success: true };
  } catch (err) {
    console.error("Save game error:", err);
    return { success: false, error: "Failed to save" };
  }
}

async function savePlayerStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  roomCode: string,
  result: NonNullable<ReturnType<GameEngine["getGameResult"]>>,
  authenticatedPlayers: Array<{
    userId: string;
    name: string;
    role: string;
    team: string;
    survived: boolean;
    survivalRound: number;
  }>
) {
  try {
    // Get the game ID we just inserted
    const { data: game } = await sb
      .from("games")
      .select("id")
      .eq("room_code", roomCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!game) return;

    // Fetch current ratings
    const userIds = authenticatedPlayers.map((p) => p.userId);
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, rating")
      .in("id", userIds);

    const ratingMap: Record<string, number> = {};
    for (const p of profiles ?? []) {
      ratingMap[p.id] = p.rating ?? 1200;
    }

    // Calculate new ratings
    const newRatings = calculateRatings(authenticatedPlayers, ratingMap, result);

    // Insert game_players
    const gamePlayerRows = authenticatedPlayers.map((p) => ({
      game_id: game.id,
      user_id: p.userId,
      role: p.role,
      team: p.team,
      survived: p.survived,
      survival_round: p.survivalRound,
      team_won: (p.team === "mafia" && result.winner === "MAFIA") ||
        (p.team === "city" && result.winner === "CITY"),
      rating_before: ratingMap[p.userId] ?? 1200,
      rating_after: newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200,
      rating_delta: (newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200) -
        (ratingMap[p.userId] ?? 1200),
    }));

    await sb.from("game_players").insert(gamePlayerRows);

    // Update profiles
    for (const p of authenticatedPlayers) {
      const teamWon = (p.team === "mafia" && result.winner === "MAFIA") ||
        (p.team === "city" && result.winner === "CITY");
      await sb.rpc("update_player_stats", {
        p_user_id: p.userId,
        p_new_rating: newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200,
        p_won: teamWon,
      });
    }
  } catch (err) {
    console.error("Player stats save error:", err);
  }
}

function calculateRatings(
  players: Array<{
    userId: string;
    team: string;
    survived: boolean;
    survivalRound: number;
  }>,
  currentRatings: Record<string, number>,
  result: { winner: string; totalRounds: number }
): Record<string, number> {
  const K = 32;
  const newRatings: Record<string, number> = {};

  const mafiaPlayers = players.filter((p) => p.team === "mafia");
  const cityPlayers = players.filter((p) => p.team === "city");

  const avgMafiaRating =
    mafiaPlayers.length > 0
      ? mafiaPlayers.reduce((s, p) => s + (currentRatings[p.userId] ?? 1200), 0) /
        mafiaPlayers.length
      : 1200;
  const avgCityRating =
    cityPlayers.length > 0
      ? cityPlayers.reduce((s, p) => s + (currentRatings[p.userId] ?? 1200), 0) /
        cityPlayers.length
      : 1200;

  for (const player of players) {
    const myRating = currentRatings[player.userId] ?? 1200;
    const oppAvgRating = player.team === "mafia" ? avgCityRating : avgMafiaRating;

    const teamWon =
      (player.team === "mafia" && result.winner === "MAFIA") ||
      (player.team === "city" && result.winner === "CITY");
    const actual = teamWon ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (oppAvgRating - myRating) / 400));
    const baseDelta = K * (actual - expected);

    // Survival multiplier: surviving longer = higher multiplier
    const survivalRatio = result.totalRounds > 0
      ? player.survivalRound / result.totalRounds
      : 1;
    const survivalMultiplier = 0.8 + 0.4 * survivalRatio;

    // Penultimate round bonus
    const penultimateBonus =
      player.survivalRound >= result.totalRounds - 1 ? 4 : 0;

    const delta = baseDelta * survivalMultiplier + penultimateBonus;
    newRatings[player.userId] = Math.max(100, Math.round((myRating + delta) * 10) / 10);
  }

  return newRatings;
}
