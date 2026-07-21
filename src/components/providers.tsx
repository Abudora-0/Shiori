"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { runAutoBackupIfDue } from "@/lib/autobackup";
import { runAutoUpdateCheckIfDue } from "@/lib/updates";

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
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
