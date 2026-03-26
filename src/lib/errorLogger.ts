/** Client-side error logger — sends errors to Supabase for admin visibility. */

let supabaseInstance: ReturnType<typeof import("@supabase/supabase-js").createClient> | null = null;

function getClient() {
  if (supabaseInstance) return supabaseInstance;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const { createClient } = require("@supabase/supabase-js");
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch {
    return null;
  }
}

export async function logError(error: {
  message: string;
  stack?: string;
  page?: string;
  userAgent?: string;
  context?: string;
}) {
  try {
    const client = getClient();
    if (!client) return;

    await (client as any).from("client_errors").insert({
      message: error.message?.slice(0, 500),
      stack: error.stack?.slice(0, 2000),
      page: error.page || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
      user_agent: error.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 500) : "unknown"),
      context: error.context || null,
    });
  } catch {
    // Silently fail — don't let error logging cause more errors
  }
}

/** Install global error handlers. Call once at app init. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    logError({
      message: event.message || "Unknown error",
      stack: event.error?.stack,
      context: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logError({
      message: reason?.message || String(reason) || "Unhandled promise rejection",
      stack: reason?.stack,
      context: "unhandledrejection",
    });
  });
}
