"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { displayTitle, isWatched } from "@/lib/format";
import type { Series } from "@/lib/types";

interface ApInfo {
  url: string;
  name: string;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  contentWarnings: string[];
  rank?: number;
}

/** Anime-Planet extras: their community rating, tags and content warnings. */
export function ApInfoCard({ series }: { series: Series }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ap-info", series.id],
    staleTime: Infinity,
    retry: 0,
    queryFn: async () => {
      const type = isWatched(series.kind) ? "anime" : "manga";
      const res = await fetch(
        `/api/proxy/animeplanet?title=${encodeURIComponent(displayTitle(series.title))}&type=${type}`
      );
      if (!res.ok) return null;
      return (await res.json()) as ApInfo;
    },
  });

  // Silent when AP has nothing - it's supplementary info, not a core section
  if (isLoading || !data) return null;

  return (
    <div className="mt-6 max-w-3xl rounded-xl border border-line bg-ink-850 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-display text-sm font-semibold text-text">
          Anime-Planet
        </span>
        {data.rating != null && (
          <span className="text-sm text-gold">
            ★ {data.rating.toFixed(2)}
            <span className="ml-1 text-xs text-faint">
              / 5{data.ratingCount ? ` · ${data.ratingCount.toLocaleString()} votes` : ""}
            </span>
          </span>
        )}
        {data.rank != null && (
          <span className="text-xs text-muted">Rank #{data.rank.toLocaleString()}</span>
        )}
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-sakura hover:underline"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>

      {data.contentWarnings.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <TriangleAlert size={13} className="text-gold" />
          {data.contentWarnings.map((w) => (
            <span
              key={w}
              className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {data.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-ink-800 px-2.5 py-1 text-[11px] text-faint"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
