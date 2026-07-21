"use client";

import Link from "next/link";
import { Heart, Pencil, Plus } from "lucide-react";
import type { LibraryItem } from "@/lib/hooks";
import {
  displayTitle,
  formatRating,
  maxProgress,
  progressUnit,
  statusShort,
  STATUS_COLOR,
} from "@/lib/format";
import { db, logActivity } from "@/lib/db";
import { useUiStore } from "@/lib/store";
import { Cover } from "@/components/ui/Cover";

export function CoverCard({ item }: { item: LibraryItem }) {
  const { series, entry } = item;
  const openEdit = useUiStore((s) => s.openEdit);
  const total = maxProgress(series);
  const pct = total ? Math.min(entry.progress / total, 1) : 0;

  async function bumpProgress(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = entry.progress + 1;
    const done = total != null && next >= total;
    await db.entries.update(entry.seriesId, {
      progress: total != null ? Math.min(next, total) : next,
      status: done ? "completed" : entry.status === "planning" ? "current" : entry.status,
      finishedAt:
        done && !entry.finishedAt
          ? new Date().toISOString().slice(0, 10)
          : entry.finishedAt,
      updatedAt: Date.now(),
    });
    await logActivity();
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await db.entries.update(entry.seriesId, {
      favorite: !entry.favorite,
      updatedAt: Date.now(),
    });
  }

  function onEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openEdit(entry.seriesId);
  }

  return (
    /* content-visibility keeps offscreen cards unpainted — big scroll win */
    <div className="[content-visibility:auto] [contain-intrinsic-size:auto_300px]">
      <Link href={`/series/${series.id}`} className="group block">
        <div
          className="card-glow relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800"
          style={{ backgroundColor: series.coverColor ?? undefined }}
        >
          <Cover
            src={series.cover}
            alt={displayTitle(series.title)}
            className="h-full w-full object-cover text-4xl transition-transform duration-500 group-hover:scale-105"
          />

          {/* status chip */}
          <span
            className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm"
            style={{ color: STATUS_COLOR[entry.status] }}
          >
            {statusShort(entry.status, series.kind)}
          </span>

          {/* favorite */}
          <button
            onClick={toggleFavorite}
            aria-label="Toggle favorite"
            className={`absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 backdrop-blur-sm transition-all ${
              entry.favorite
                ? "text-vermillion-bright"
                : "text-white/50 opacity-0 hover:text-white group-hover:opacity-100"
            }`}
          >
            <Heart size={14} fill={entry.favorite ? "currentColor" : "none"} />
          </button>

          {/* hover actions */}
          <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-8 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="text-[11px] leading-tight text-white/85">
              <div className="font-semibold text-gold">
                ★ {formatRating(entry.rating)}
              </div>
              <div>
                {entry.progress}
                {total ? ` / ${total}` : ""} {progressUnit(series.kind)}
              </div>
            </div>
            <div className="flex gap-1">
              {entry.status !== "completed" && (
                <button
                  onClick={bumpProgress}
                  aria-label="+1 progress"
                  className="rounded-md bg-vermillion p-1.5 text-white shadow-md transition-transform hover:scale-110"
                >
                  <Plus size={13} strokeWidth={3} />
                </button>
              )}
              <button
                onClick={onEdit}
                aria-label="Edit entry"
                className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>

          {/* progress ink stroke */}
          {pct > 0 && entry.status !== "completed" && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/50">
              <div className="ink-stroke h-full" style={{ width: `${pct * 100}%` }} />
            </div>
          )}
        </div>

        <div className="mt-1.5 truncate text-[13px] font-medium text-text/90 group-hover:text-white">
          {displayTitle(series.title)}
        </div>
        <div className="text-[11px] text-faint">
          {series.year ?? ""}
          {series.format ? ` · ${series.format.replace(/_/g, " ")}` : ""}
        </div>
      </Link>
    </div>
  );
}
