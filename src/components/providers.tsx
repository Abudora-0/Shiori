"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { runAutoBackupIfDue } from "@/lib/autobackup";
import { runAutoUpdateCheckIfDue } from "@/lib/updates";
import { isUnlocked } from "@/lib/annex";
import { getMatureRevealed } from "@/lib/mature";
import { useUiStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );

  useEffect(() => {
    // PWA installability + due auto-backups + due update checks
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    runAutoBackupIfDue();
    runAutoUpdateCheckIfDue();
    // sessionStorage isn't readable during SSR, so the store starts locked
    // and syncs to the real (already-unlocked-this-session) state post-mount.
    if (isUnlocked()) useUiStore.getState().setAnnexUnlocked(true);
    getMatureRevealed().then((v) => useUiStore.getState().setMatureRevealed(v));
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
