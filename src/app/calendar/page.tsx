"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { Tv } from "lucide-react";
import { db } from "@/lib/db";
import { gql } from "@/lib/anilist";
import { displayTitle } from "@/lib/format";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { Cover } from "@/components/ui/Cover";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Series } from "@/lib/types";

interface Airing {
  mediaId: number;
  episode: number;
  airingAt: number; // unix seconds
}

const AIRING_QUERY = `
query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      mediaId
      episode
      airingAt
    }
  }
}`;

async function fetchAiring(ids: number[]): Promise<Airing[]> {
  const from = Math.floor(Date.now() / 1000) - 24 * 3600;
  const to = Math.floor(Date.now() / 1000) + 8 * 24 * 3600;
  const out: Airing[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    let page = 1;
    for (;;) {
      const data = await gql<{
        Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Airing[] };
      }>(AIRING_QUERY, { ids: chunk, from, to, page });
      out.push(...data.Page.airingSchedules);
      if (!data.Page.pageInfo.hasNextPage) break;
      page++;
    }
  }
  return out.sort((a, b) => a.airingAt - b.airingAt);
}

export default function CalendarPage() {
  // Airing candidates: library anime that are releasing or upcoming
  const watching = useLiveQuery(async () => {
    const entries = await db.entries.toArray();
    const series = await db.series.bulkGet(entries.map((e) => e.seriesId));
    const map = new Map<number, Series>();
    for (let i = 0; i < entries.length; i++) {
      const s = series[i];
      if (
        s &&
        s.kind === "ANIME" &&
        s.id > 0 &&
        entries[i].status !== "dropped" &&
        (s.mediaStatus === "RELEASING" || s.mediaStatus === "NOT_YET_RELEASED")
      ) {
        map.set(s.id, s);
      }
    }
    return map;
  }, []);

  const ids = useMemo(
    () => (watching ? [...watching.keys()].sort((a, b) => a - b) : undefined),
    [watching]
  );

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["airing", ids?.join(",")],
    enabled: !!ids && ids.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () => fetchAiring(ids!),
  });

  const days = useMemo(() => {
    if (!schedule || !watching) return undefined;
    const groups = new Map<string, { date: Date; items: (Airing & { series: Series })[] }>();
    for (const a of schedule) {
      const series = watching.get(a.mediaId);
      if (!series) continue;
      const d = new Date(a.airingAt * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!groups.has(key)) groups.set(key, { date: d, items: [] });
      groups.get(key)!.items.push({ ...a, series });
    }
    return [...groups.values()];
  }, [schedule, watching]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="放送"
        title="Airing calendar"
        subtitle="When the anime on your shelf airs — past day and coming week."
      />

      {watching && watching.size === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Tv size={40} className="text-ink-600" />
          <p className="mt-4 max-w-sm text-sm text-muted">
            Nothing currently airing in your library. Add some seasonal anime and
            they&apos;ll show up here with air times.
          </p>
        </div>
      ) : isLoading || !days ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No episodes scheduled in the coming week for your shows.
        </p>
      ) : (
        <div className="space-y-8 pb-16">
          {days.map(({ date, items }) => (
            <section key={date.toISOString()}>
              <h2 className="mb-3 font-display text-lg font-semibold">
                {dayLabel(date)}
                <span className="ml-2 text-xs font-normal text-faint">
                  {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-line">
                {items.map((item, i) => (
                  <AiringRow key={`${item.mediaId}-${item.episode}`} item={item} zebra={i % 2 === 1} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AiringRow({
  item,
  zebra,
}: {
  item: Airing & { series: Series };
  zebra: boolean;
}) {
  const t = new Date(item.airingAt * 1000);
  const aired = item.airingAt * 1000 <= Date.now();
  return (
    <Link
      href={`/series/${item.series.id}`}
      className={`flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-ink-800 ${
        zebra ? "bg-ink-900/60" : "bg-ink-850/60"
      }`}
    >
      <span className="w-14 shrink-0 font-display text-sm text-mizu">
        {t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </span>
      <div className="h-12 w-9 shrink-0 overflow-hidden rounded">
        <Cover src={item.series.cover} alt="" className="h-full w-full object-cover text-base" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {displayTitle(item.series.title)}
        </div>
        <div className="text-xs text-faint">
          Episode {item.episode}
          {item.series.episodes ? ` of ${item.series.episodes}` : ""}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
          aired ? "bg-matcha/15 text-matcha" : "bg-ink-700 text-muted"
        }`}
      >
        {aired ? "Aired" : countdown(item.airingAt)}
      </span>
    </Link>
  );
}

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function countdown(airingAt: number): string {
  const diff = airingAt * 1000 - Date.now();
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 24) return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `in ${hours}h ${Math.floor((diff % 3_600_000) / 60_000)}m`;
  return `in ${Math.max(1, Math.floor(diff / 60_000))}m`;
}
