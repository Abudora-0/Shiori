"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { SeriesResultCard } from "@/components/SeriesResultCard";
import { gql, MEDIA_FIELDS, mapMediaToSeries, type RawMedia } from "@/lib/anilist";
import { useLibraryIds } from "@/lib/hooks";
import type { Series } from "@/lib/types";

type Tab = "season" | "anime" | "manga" | "manhwa" | "pornhwa";

const TABS: { id: Tab; label: string }[] = [
  { id: "season", label: "This Season" },
  { id: "anime", label: "Trending Anime" },
  { id: "manga", label: "Trending Manga" },
  { id: "manhwa", label: "Trending Manhwa" },
  { id: "pornhwa", label: "Pornhwa" },
];

function currentSeason(): { season: string; year: number } {
  const now = new Date();
  const m = now.getMonth() + 1;
  const season =
    m <= 3 ? "WINTER" : m <= 6 ? "SPRING" : m <= 9 ? "SUMMER" : "FALL";
  return { season, year: now.getFullYear() };
}

async function fetchPage(tab: Tab, page: number): Promise<{ series: Series[]; hasNext: boolean }> {
  const { season, year } = currentSeason();
  const args: Record<Tab, { vars: Record<string, unknown>; filter: string }> = {
    season: {
      vars: { season, seasonYear: year },
      filter:
        "type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC",
    },
    anime: { vars: {}, filter: "type: ANIME, sort: TRENDING_DESC, isAdult: false" },
    manga: { vars: {}, filter: "type: MANGA, sort: TRENDING_DESC, isAdult: false" },
    manhwa: {
      vars: {},
      filter: 'type: MANGA, countryOfOrigin: "KR", sort: TRENDING_DESC, isAdult: false',
    },
    pornhwa: {
      vars: {},
      filter: 'type: MANGA, countryOfOrigin: "KR", sort: TRENDING_DESC, isAdult: true',
    },
  };
  const { vars, filter } = args[tab];
  const varDefs = tab === "season" ? ", $season: MediaSeason, $seasonYear: Int" : "";
  const query = `
    query ($page: Int${varDefs}) {
      Page(page: $page, perPage: 24) {
        pageInfo { hasNextPage }
        media(${filter}) { ${MEDIA_FIELDS} }
      }
    }`;
  const data = await gql<{
    Page: { pageInfo: { hasNextPage: boolean }; media: RawMedia[] };
  }>(query, { page, ...vars });
  return {
    series: data.Page.media.map(mapMediaToSeries),
    hasNext: data.Page.pageInfo.hasNextPage,
  };
}

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("season");
  const libraryIds = useLibraryIds();

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["discover", tab],
      initialPageParam: 1,
      queryFn: ({ pageParam }) => fetchPage(tab, pageParam),
      getNextPageParam: (last, all) => (last.hasNext ? all.length + 1 : undefined),
      staleTime: 30 * 60_000,
    });

  const all = data?.pages.flatMap((p) => p.series) ?? [];
  // De-dupe across pages (AniList trending can shift between requests)
  const seen = new Set<number>();
  const series = all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="発見"
        title="Discover"
        subtitle="What's airing, what's trending - add anything straight to your Planning shelf."
      />

      <div className="no-scrollbar -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "brush-underline text-text" : "text-faint hover:text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={12} />
      ) : isError ? (
        <p className="py-16 text-center text-vermillion-bright">
          AniList didn&apos;t answer - likely rate-limited, try again shortly.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {series.map((s) => (
              <SeriesResultCard
                key={s.id}
                series={s}
                inLibrary={libraryIds?.has(s.id) ?? false}
              />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center py-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-2 rounded-lg border border-line-strong px-6 py-2.5 text-sm text-muted transition-colors hover:border-vermillion/60 hover:text-text disabled:opacity-50"
              >
                {isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
