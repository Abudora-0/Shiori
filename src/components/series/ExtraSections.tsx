"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookmarkCheck } from "lucide-react";
import { CharacterModal } from "./CharacterModal";
import { db } from "@/lib/db";
import { fetchSeriesExtra } from "@/lib/anilist";
import { useLibraryIds } from "@/lib/hooks";
import { displayTitle, kindLabel } from "@/lib/format";
import { useUiStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/Skeleton";
import { Cover } from "@/components/ui/Cover";
import type { SeriesExtra } from "@/lib/types";

const EXTRA_TTL = 7 * 24 * 60 * 60 * 1000;

function useSeriesExtra(seriesId: number) {
  return useQuery<SeriesExtra>({
    queryKey: ["extra", seriesId],
    enabled: seriesId > 0, // MAL-only entries (negative ids) have no AniList detail
    queryFn: async () => {
      const cached = await db.extras.get(seriesId);
      if (cached && Date.now() - cached.cachedAt < EXTRA_TTL) return cached;
      const fresh = await fetchSeriesExtra(seriesId);
      await db.extras.put(fresh);
      return fresh;
    },
    staleTime: Infinity,
  });
}

export function ExtraSections({ seriesId }: { seriesId: number }) {
  const { data, isLoading, isError } = useSeriesExtra(seriesId);
  const libraryIds = useLibraryIds();
  const matureRevealed = useUiStore((s) => s.matureRevealed);
  const [characterId, setCharacterId] = useState<number | null>(null);

  if (seriesId < 0) return null;
  if (isError)
    return (
      <p className="text-sm text-faint">
        Couldn&apos;t load characters &amp; recommendations from AniList right now.
      </p>
    );

  return (
    <div className="space-y-10">
      {/* Characters */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Characters</h2>
        {isLoading ? (
          <RailSkeleton />
        ) : !data?.characters.length ? (
          <p className="text-sm text-faint">No character data available.</p>
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {data.characters.map((c) => (
              <button
                key={c.id}
                onClick={() => setCharacterId(c.id)}
                className="card-glow w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line bg-ink-850 text-left"
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center font-display text-2xl text-faint">
                    人
                  </div>
                )}
                <div className="p-2">
                  <div className="truncate text-xs font-medium" title={c.name}>
                    {c.name}
                  </div>
                  <div className="truncate text-[10px] text-faint">
                    {c.role === "MAIN" ? "Main" : "Support"}
                  </div>
                  {c.voiceActor && (
                    <div
                      className="mt-1 truncate border-t border-line pt-1 text-[10px] text-muted"
                      title={`CV: ${c.voiceActor.name}`}
                    >
                      CV {c.voiceActor.name}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <CharacterModal characterId={characterId} onClose={() => setCharacterId(null)} />

      {/* Relations */}
      {!!data?.relations.length && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Related</h2>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {data.relations.map((r) => (
              <Link
                key={`${r.relationType}-${r.id}`}
                href={`/series/${r.id}`}
                className="group w-32 shrink-0"
              >
                <div className="card-glow aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800">
                  <Cover
                    src={r.cover}
                    alt=""
                    className="h-full w-full object-cover text-3xl transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-sakura">
                  {r.relationType}
                </div>
                <div className="truncate text-xs text-text/90">
                  {displayTitle(r.title)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Similar to this */}
      {!!data?.recommendations.length && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Similar to this</h2>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {data.recommendations.map((r) => {
              const inLibrary = libraryIds?.has(r.id);
              return (
                <Link key={r.id} href={`/series/${r.id}`} className="group w-32 shrink-0">
                  <div className="card-glow relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800">
                    <Cover
                      src={r.cover}
                      alt=""
                      className="h-full w-full object-cover text-3xl transition-transform duration-500 group-hover:scale-105"
                    />
                    {inLibrary && (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-matcha backdrop-blur-sm">
                        <BookmarkCheck size={11} /> In library
                      </span>
                    )}
                    {r.meanScore && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-display text-[11px] text-gold backdrop-blur-sm">
                        {(r.meanScore / 10).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-text/90">
                    {displayTitle(r.title)}
                  </div>
                  <div className="text-[10px] text-faint">{kindLabel(r.kind, matureRevealed)}</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-28 shrink-0">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
