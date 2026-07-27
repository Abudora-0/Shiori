"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { StatCounter } from "@/components/ui/StatCounter";
import { CoverCard } from "@/components/library/CoverCard";
import { EditEntryModal } from "@/components/library/EditEntryModal";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { useLibrary, type LibraryItem } from "@/lib/hooks";
import { displayTitle, formatDate, isWatched, statusLabel } from "@/lib/format";

export default function Dashboard() {
  const items = useLibrary();

  const stats = useMemo(() => {
    if (!items) return undefined;
    const anime = items.filter((i) => isWatched(i.series.kind));
    const reading = items.filter((i) => !isWatched(i.series.kind));
    const rated = items.filter((i) => (i.entry.rating ?? 0) > 0);
    const mean =
      rated.length > 0
        ? rated.reduce((s, i) => s + i.entry.rating!, 0) / rated.length / 10
        : 0;
    const episodes = anime.reduce((s, i) => s + i.entry.progress, 0);
    const chapters = reading.reduce((s, i) => s + i.entry.progress, 0);
    return { total: items.length, episodes, chapters, mean };
  }, [items]);

  const watching = useMemo(
    () =>
      items
        ?.filter((i) => i.entry.status === "current" && isWatched(i.series.kind))
        .sort((a, b) => b.entry.updatedAt - a.entry.updatedAt)
        .slice(0, 14),
    [items]
  );

  const reading = useMemo(
    () =>
      items
        ?.filter((i) => i.entry.status === "current" && !isWatched(i.series.kind))
        .sort((a, b) => b.entry.updatedAt - a.entry.updatedAt)
        .slice(0, 14),
    [items]
  );

  const recent = useMemo(
    () => items?.slice().sort((a, b) => b.entry.updatedAt - a.entry.updatedAt).slice(0, 8),
    [items]
  );

  const empty = items !== undefined && items.length === 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="栞"
        title="Welcome back"
        subtitle="Your bookmark between worlds. Pick up where you left off."
      />

      {empty ? (
        <Welcome />
      ) : (
        <>
          {/* Stats */}
          <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCounter value={stats?.total ?? 0} label="In library" />
            <StatCounter value={stats?.episodes ?? 0} label="Episodes watched" />
            <StatCounter value={stats?.chapters ?? 0} label="Chapters read" />
            <StatCounter value={stats?.mean ?? 0} label="Mean score" decimals={1} />
          </div>

          <Rail title="Continue watching" items={watching} emptyText="Nothing being watched right now." />
          <Rail title="Continue reading" items={reading} emptyText="Nothing being read right now." />

          {/* Recent activity */}
          {!!recent?.length && (
            <section className="mt-10 max-w-2xl">
              <h2 className="mb-3 font-display text-xl font-semibold">
                Recent activity
              </h2>
              <ul className="space-y-1">
                {recent.map(({ series, entry }) => (
                  <li key={series.id}>
                    <Link
                      href={`/series/${series.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-ink-800"
                    >
                      <span className="w-24 shrink-0 text-[11px] text-faint">
                        {formatDate(entry.updatedAt)}
                      </span>
                      <span className="truncate text-text/90">
                        {displayTitle(series.title)}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted">
                        {statusLabel(entry.status, series.kind)} · {entry.progress}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <EditEntryModal />
    </div>
  );
}

function Rail({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: LibraryItem[] | undefined;
  emptyText: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <Link
          href="/library"
          className="flex items-center gap-1 text-xs text-faint transition-colors hover:text-sakura"
        >
          Library <ArrowRight size={13} />
        </Link>
      </div>
      {!items ? (
        <CardGridSkeleton count={7} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-faint">
          {emptyText}
        </p>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {items.map((item) => (
            <div key={item.series.id} className="w-32 shrink-0 md:w-36">
              <CoverCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Welcome() {
  return (
    <div className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border border-line bg-ink-850 p-8 text-center md:p-12">
      <div className="seigaiha absolute inset-0 opacity-[0.04]" />
      <div className="relative">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-vermillion bg-paper font-display text-3xl font-bold text-[#16161f] shadow-[0_0_28px_rgba(230,57,70,0.5)]">
          栞
        </div>
        <h2 className="mt-6 font-display text-2xl font-bold">
          Welcome to Shiori
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          <span className="font-display text-sakura">栞 (shiori)</span> - a bookmark.
          Import your lists from AniList or MyAnimeList and keep every anime, manga,
          manhwa and manhua in one beautifully dark shelf. Everything stays on your
          device.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/import"
            className="rounded-lg bg-vermillion px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
          >
            Import your lists
          </Link>
          <Link
            href="/search"
            className="rounded-lg border border-line-strong px-6 py-2.5 text-sm font-medium text-muted transition-colors hover:border-vermillion/60 hover:text-text"
          >
            Search &amp; add manually
          </Link>
        </div>
      </div>
    </div>
  );
}
