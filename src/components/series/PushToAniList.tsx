"use client";

import { useEffect, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { getConnection, pushEntryToAniList } from "@/lib/anilist-sync";
import type { LibraryEntry, Series } from "@/lib/types";

/** Manually push this series' local status/progress/score to AniList. */
export function PushToAniList({
  series,
  entry,
}: {
  series: Series;
  entry: LibraryEntry;
}) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  useEffect(() => {
    getConnection().then((c) => setConnected(c.connected));
  }, []);

  if (series.id <= 0 || !connected) return null;

  async function push() {
    setState("busy");
    try {
      await pushEntryToAniList(series, entry);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3500);
    }
  }

  return (
    <button
      onClick={push}
      disabled={state === "busy"}
      title="Push status/progress/score to AniList"
      className={`flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2.5 text-sm transition-colors hover:border-mizu/60 disabled:opacity-60 ${
        state === "done"
          ? "text-matcha"
          : state === "error"
            ? "text-vermillion"
            : "text-faint hover:text-text"
      }`}
    >
      {state === "busy" ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <CloudUpload size={16} />
      )}
      {state === "done" ? "Pushed" : state === "error" ? "Failed" : "Push"}
    </button>
  );
}
