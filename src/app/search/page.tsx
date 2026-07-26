"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { SeriesResultCard } from "@/components/SeriesResultCard";
import { searchAniList } from "@/lib/anilist";
import { useLibraryIds } from "@/lib/hooks";

type TypeFilter = "ALL" | "ANIME" | "MANGA";

/** Reads the ?q= param once on mount. Isolated + Suspense-wrapped so a bare
 * useSearchParams() read can't gate hydration of the whole page (that left
 * this route blank on a hard navigation — see settings/page.tsx's
 * OAuthCallbackHandler for the same pattern). */
function InitialQueryReader({ onQuery }: { onQuery: (q: string) => void }) {
  const q = useSearchParams().get("q") ?? "";
  const applied = useRef(false);
  useEffect(() => {
    if (!applied.current && q) {
      applied.current = true;
      onQuery(q);
    }
  }, [q, onQuery]);
  return null;
}

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("ALL");
  const libraryIds = useLibraryIds();

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 450);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", query, type],
    enabled: query.length >= 2,
    queryFn: () => searchAniList(query, type === "ALL" ? undefined : type),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <Suspense fallback={null}>
        <InitialQueryReader onQuery={(q) => { setInput(q); setQuery(q); }} />
      </Suspense>
      <KanjiHeading
        kanji="検索"
        title="Search"
        subtitle="Find any anime, manga, manhwa or manhua on AniList and add it to your shelf."
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 md:max-w-xl">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search titles… (e.g. Frieren, Omniscient Reader)"
            className="w-full rounded-xl border border-line-strong bg-ink-850 py-3 pl-11 pr-4 text-base outline-none transition-colors focus:border-vermillion"
          />
        </div>
        <div className="flex overflow-hidden rounded-xl border border-line-strong">
          {(["ALL", "ANIME", "MANGA"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                type === t ? "bg-ink-700 text-text" : "bg-ink-850 text-faint hover:text-muted"
              }`}
            >
              {t === "ALL" ? "All" : t === "ANIME" ? "Anime" : "Manga+"}
            </button>
          ))}
        </div>
      </div>

      {query.length < 2 ? (
        <div className="py-24 text-center">
          <div className="font-display text-7xl text-ink-600">探</div>
          <p className="mt-4 text-sm text-muted">Type at least two characters to search.</p>
        </div>
      ) : isFetching && !data ? (
        <CardGridSkeleton count={10} />
      ) : isError ? (
        <p className="py-16 text-center text-vermillion-bright">
          Search failed — AniList may be rate-limiting. Try again shortly.
        </p>
      ) : !data?.length ? (
        <p className="py-16 text-center text-muted">No results for “{query}”.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.map((series) => (
            <SeriesResultCard
              key={series.id}
              series={series}
              inLibrary={libraryIds?.has(series.id) ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
