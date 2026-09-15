"use client";

import Link from "next/link";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { displayTitle, kindLabel } from "@/lib/format";
import { useUiStore } from "@/lib/store";
import { Cover } from "@/components/ui/Cover";
import type { Series } from "@/lib/types";

/** Result card with add-to-library - used by Search and Discover. */
export function SeriesResultCard({
  series,
  inLibrary,
}: {
  series: Series;
  inLibrary: boolean;
}) {
  const matureRevealed = useUiStore((s) => s.matureRevealed);

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    const now = Date.now();
    await db.series.put(series);
    await db.entries.put({
      seriesId: series.id,
      status: "planning",
      progress: 0,
      repeats: 0,
      favorite: false,
      source: "manual",
      addedAt: now,
      updatedAt: now,
    });
    await logActivity();
  }

  return (
    <Link
      href={`/series/${series.id}`}
      className="group block [content-visibility:auto] [contain-intrinsic-size:auto_300px]"
    >
      <div className="card-glow relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800">
        <Cover
          src={series.cover}
          alt={displayTitle(series.title)}
          className="h-full w-full object-cover text-4xl transition-transform duration-500 group-hover:scale-105"
        />
        {series.meanScore != null && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 font-display text-[11px] text-gold backdrop-blur-sm">
            {(series.meanScore / 10).toFixed(1)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
          {inLibrary ? (
            <span className="flex items-center gap-1.5 rounded-md bg-matcha/20 px-2.5 py-1.5 text-xs font-medium text-matcha">
              <BookmarkCheck size={13} /> In library
            </span>
          ) : (
            <button
              onClick={add}
              className="flex items-center gap-1.5 rounded-md bg-vermillion px-2.5 py-1.5 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105"
            >
              <BookmarkPlus size={13} /> Add
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 truncate text-[13px] font-medium text-text/90">
        {displayTitle(series.title)}
      </div>
      <div className="text-[11px] text-faint">
        {kindLabel(series.kind, matureRevealed)}
        {series.year ? ` · ${series.year}` : ""}
      </div>
    </Link>
  );
}
