"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronDown } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { fetchChapters } from "@/lib/chapters";
import { useEntry } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Series } from "@/lib/types";

const SHOWN_STEP = 25;

/** Chapter list with source fallbacks: MangaDex → Comick → MangaUpdates. */
export function ChapterList({ series }: { series: Series }) {
  const entry = useEntry(series.id);
  const [shown, setShown] = useState(SHOWN_STEP);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["chapters", series.id],
    enabled: open && series.kind !== "ANIME",
    staleTime: Infinity,
    queryFn: () => fetchChapters(series),
  });

  if (series.kind === "ANIME") return null;

  async function markReadUpTo(chapterNum: number) {
    if (!entry) return;
    await db.entries.update(series.id, {
      progress: Math.max(entry.progress, Math.floor(chapterNum)),
      status: entry.status === "planning" ? "current" : entry.status,
      updatedAt: Date.now(),
    });
    await logActivity();
  }

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-ink-850 px-4 py-3 transition-colors hover:border-line-strong"
      >
        <h2 className="font-display text-xl font-semibold">
          Chapters
          {data && (
            <span className="ml-2 text-xs font-normal text-faint">
              via {data.provider}
              {!data.verified && " · title match, may be inexact"}
            </span>
          )}
        </h2>
        <ChevronDown
          size={18}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3">
          {isLoading ? (
            <div className="space-y-2">
              <p className="pb-1 text-center text-xs text-faint">
                Checking MangaKatana, KaliScan, WeebCentral and Kagane…
              </p>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-faint">
              No chapter source found for this series - tried MangaKatana,
              KaliScan, WeebCentral, Kagane and MangaUpdates.
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-line">
                {data.chapters.slice(0, shown).map((c, i) => {
                  const read =
                    entry && c.number != null && c.number <= entry.progress;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-2 text-sm ${
                        i % 2 ? "bg-ink-900/60" : "bg-ink-850/60"
                      } ${read ? "opacity-50" : ""}`}
                    >
                      <BookOpen size={14} className="shrink-0 text-faint" />
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-24 shrink-0 truncate font-display font-semibold hover:text-sakura hover:underline"
                          title={c.label}
                        >
                          {c.label}
                        </a>
                      ) : (
                        <span className="w-24 shrink-0 truncate font-display font-semibold">
                          {c.label}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {c.title || (c.volume ? `Volume ${c.volume}` : "")}
                      </span>
                      <span className="hidden max-w-40 shrink-0 truncate text-xs text-faint sm:block">
                        {c.group}
                      </span>
                      <span className="w-24 shrink-0 text-right text-xs text-faint">
                        {formatDate(c.date)}
                      </span>
                      {entry && c.number != null && !read && (
                        <button
                          onClick={() => markReadUpTo(c.number!)}
                          title={`Mark read up to ${c.label}`}
                          className="shrink-0 rounded p-1 text-faint transition-colors hover:text-matcha"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {shown < data.chapters.length && (
                <button
                  onClick={() => setShown((s) => s + SHOWN_STEP)}
                  className="mt-3 w-full rounded-lg border border-line-strong py-2 text-sm text-muted transition-colors hover:border-vermillion/60 hover:text-text"
                >
                  Show more ({data.chapters.length - shown} remaining)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
