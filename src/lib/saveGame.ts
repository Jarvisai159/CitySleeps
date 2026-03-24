import { getSupabase } from "./supabase";
import type { GameEngine } from "@/engine/GameEngine";

export async function saveGameResult(
  engine: GameEngine,
  roomCode: string
): Promise<{ success: boolean; error?: string }> {
  const result = engine.getGameResult();
  if (!result) return { success: false, error: "Game not over" };

  // Only save if there are authenticated players (UUID format IDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const authenticatedPlayers = result.players.filter((p) =>
    uuidRegex.test(p.userId)
  );
  if (authenticatedPlayers.length === 0) {
    return { success: false, error: "No authenticated players" };
  }

  try {
    const sb = getSupabase();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Try Edge Function first, fall back to direct DB insert
    const fnUrl = `${url}/functions/v1/save-game`;
    const {
      data: { session },
    } = await sb.auth.getSession();

    const response = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        roomCode,
        winner: result.winner,
        totalRounds: result.totalRounds,
        players: authenticatedPlayers,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Save game error:", text);
      // Fall back to direct insert
      return await saveGameDirect(sb, roomCode, result, authenticatedPlayers);
    }

    return { success: true };
  } catch (err) {
    console.error("Save game error:", err);
    return { success: false, error: "Failed to save" };
  }
}

async function saveGameDirect(
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
    // Insert game record
    const { data: game, error: gameError } = await sb
      .from("games")
      .insert({
        room_code: roomCode,
        winner: result.winner,
        total_rounds: result.totalRounds,
        player_count: result.players.length,
      })
      .select("id")
      .single();

    if (gameError) {
      console.error("Game insert error:", gameError);
      return { success: false, error: gameError.message };
    }

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
        (p.team === "village" && result.winner === "VILLAGE"),
      rating_before: ratingMap[p.userId] ?? 1200,
      rating_after: newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200,
      rating_delta: (newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200) -
        (ratingMap[p.userId] ?? 1200),
    }));

    await sb.from("game_players").insert(gamePlayerRows);

    // Update profiles
    for (const p of authenticatedPlayers) {
      const teamWon = (p.team === "mafia" && result.winner === "MAFIA") ||
        (p.team === "village" && result.winner === "VILLAGE");
      await sb.rpc("update_player_stats", {
        p_user_id: p.userId,
        p_new_rating: newRatings[p.userId] ?? ratingMap[p.userId] ?? 1200,
        p_won: teamWon,
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Direct save error:", err);
    return { success: false, error: "Failed to save directly" };
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
  const villagePlayers = players.filter((p) => p.team === "village");

  const avgMafiaRating =
    mafiaPlayers.length > 0
      ? mafiaPlayers.reduce((s, p) => s + (currentRatings[p.userId] ?? 1200), 0) /
        mafiaPlayers.length
      : 1200;
  const avgVillageRating =
    villagePlayers.length > 0
      ? villagePlayers.reduce((s, p) => s + (currentRatings[p.userId] ?? 1200), 0) /
        villagePlayers.length
      : 1200;

  for (const player of players) {
    const myRating = currentRatings[player.userId] ?? 1200;
    const oppAvgRating = player.team === "mafia" ? avgVillageRating : avgMafiaRating;

    const teamWon =
      (player.team === "mafia" && result.winner === "MAFIA") ||
      (player.team === "village" && result.winner === "VILLAGE");
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
