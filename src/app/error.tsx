"use client";

import { useEffect } from "react";
import { logError } from "@/lib/errorLogger";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    logError({
      message: error.message,
      stack: error.stack,
      context: "error-boundary",
    });
  }, [error]);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-px bg-red-500 mx-auto mb-8" />
      <h1 className="text-2xl font-black uppercase tracking-wider mb-3">Something went wrong</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-xs">
        Try refreshing the page. If it keeps happening, try a different browser.
      </p>
      <button
        onClick={reset}
        className="py-3 px-10 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors"
      >
        Try Again
      </button>
    </main>
  );
}
