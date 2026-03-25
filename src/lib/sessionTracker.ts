import { getSupabase } from "./supabase";
import type { GameMode } from "./gameTheme";

let currentSessionId: string | null = null;

/** Get user's timezone and approximate location from browser */
function getLocationInfo(): { timezone: string; country: string | null; city: string | null } {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Dubai"
  // Extract rough location from timezone
  const parts = timezone.split("/");
  const city = parts.length > 1 ? parts[parts.length - 1].replace(/_/g, " ") : null;
  const country = parts.length > 0 ? parts[0] : null; // continent, not country — we'll enhance via IP later if needed
  return { timezone, country, city };
}

/** Track when host opens the page (creates a room) */
export async function trackSessionOpened(roomCode: string, gameMode: GameMode): Promise<void> {
  try {
    const sb = getSupabase();
    const loc = getLocationInfo();

    const { data, error } = await sb
      .from("game_sessions")
      .insert({
        room_code: roomCode,
        game_mode: gameMode,
        status: "opened",
        player_count: 0,
        timezone: loc.timezone,
        country: loc.country,
        city: loc.city,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Session track (opened) error:", error);
      return;
    }
    currentSessionId = data?.id ?? null;
  } catch (err) {
    console.error("Session track error:", err);
  }
}

/** Track when host starts the game */
export async function trackSessionStarted(playerCount: number, gameMode: GameMode): Promise<void> {
  if (!currentSessionId) return;
  try {
    const sb = getSupabase();
    await sb
      .from("game_sessions")
      .update({
        status: "started",
        player_count: playerCount,
        game_mode: gameMode,
        started_at: new Date().toISOString(),
      })
      .eq("id", currentSessionId);
  } catch (err) {
    console.error("Session track (started) error:", err);
  }
}

/** Track when game completes */
export async function trackSessionCompleted(playerCount: number): Promise<void> {
  if (!currentSessionId) return;
  try {
    const sb = getSupabase();
    await sb
      .from("game_sessions")
      .update({
        status: "completed",
        player_count: playerCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", currentSessionId);
  } catch (err) {
    console.error("Session track (completed) error:", err);
  }
}

/** Reset session ID (for play again) */
export function resetSessionId(): void {
  currentSessionId = null;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}
