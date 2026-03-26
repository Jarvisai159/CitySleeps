"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";

export function ErrorBoundaryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return <>{children}</>;
}
