"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BookmarkPlus, Heart, Pencil, Plus } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { fetchSeriesById } from "@/lib/anilist";
import { useEntry, useSeries } from "@/lib/hooks";
import { useUiStore } from "@/lib/store";
import {
  displayTitle,
  isAdultKind,
  isWatched,
  KIND_LABEL,
  maxProgress,
  progressUnit,
  statusLabel,
  STATUS_COLOR,
  subTitle,
} from "@/lib/format";
import { PinGate } from "@/components/annex/PinGate";
import { EnsoScore } from "@/components/ui/EnsoScore";
import { Chip } from "@/components/ui/Chip";
import { Cover } from "@/components/ui/Cover";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditEntryModal } from "@/components/library/EditEntryModal";
import { ReviewSection } from "@/components/series/ReviewSection";
import { NotesSection } from "@/components/series/NotesSection";
import { ExtraSections } from "@/components/series/ExtraSections";
import { ChapterList } from "@/components/series/ChapterList";
import { ApInfoCard } from "@/components/series/ApInfoCard";
import { AddToListButton } from "@/components/series/AddToListButton";
import { LinkToAniList } from "@/components/series/LinkToAniList";
import { PushToAniList } from "@/components/series/PushToAniList";
import type { Series } from "@/lib/types";

export default function SeriesPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const local = useSeries(Number.isFinite(id) ? id : null);
  const entry = useEntry(Number.isFinite(id) ? id : null);

  // Not in local db (e.g. arrived via relations/similar) → fetch from AniList
  const remote = useQuery<Series>({
    queryKey: ["series", id],
    enabled: local === null && id > 0,
    queryFn: () => fetchSeriesById(id),
    staleTime: Infinity,
  });

  const series = local ?? remote.data;

  if (!series) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="mt-6 flex gap-6">
          <Skeleton className="h-64 w-44 shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        {remote.isError && (
          <p className="mt-8 text-center text-vermillion-bright">
            Couldn&apos;t load this series from AniList.
          </p>
        )}
      </div>
    );
  }

  if (isAdultKind(series.kind)) {
    return (
      <PinGate
        title={`Unlock ${KIND_LABEL[series.kind]}`}
        subtitle="This series is on the Hentai/Pornhwa shelf, which hides behind the Annex PIN. It locks again when the browser closes."
      >
        <SeriesDetail series={series} inLibrary={!!entry} />
      </PinGate>
    );
  }

  return <SeriesDetail series={series} inLibrary={!!entry} />;
}

function SeriesDetail({ series, inLibrary }: { series: Series; inLibrary: boolean }) {
  const entry = useEntry(series.id);
  const openEdit = useUiStore((s) => s.openEdit);
  const [expanded, setExpanded] = useState(false);
  const total = maxProgress(series);

  async function addToLibrary() {
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

  async function bumpProgress() {
    if (!entry) return;
    const next = entry.progress + 1;
    const done = total != null && next >= total;
    await db.entries.update(entry.seriesId, {
      progress: total != null ? Math.min(next, total) : next,
      status: done ? "completed" : entry.status === "planning" ? "current" : entry.status,
      updatedAt: Date.now(),
    });
    await logActivity();
  }

  return (
    <div>
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden md:h-64">
        {series.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={series.banner}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div
            className="seigaiha h-full w-full opacity-40"
            style={{ backgroundColor: series.coverColor ?? "var(--ink-800)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/15" />
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        {/* Header */}
        <div className="relative z-10 -mt-20 flex flex-col gap-5 md:-mt-28 md:flex-row md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-36 shrink-0 md:w-48"
          >
            <div className="card-glow aspect-[2/3] overflow-hidden rounded-xl border-2 border-ink-700 bg-ink-800 shadow-2xl">
              <Cover
                src={series.cover}
                alt={displayTitle(series.title)}
                className="h-full w-full object-cover text-5xl"
              />
            </div>
          </motion.div>

          <div className="flex-1 pb-2 md:pt-14">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="rounded bg-vermillion/15 px-2 py-0.5 font-medium text-vermillion-bright">
                {KIND_LABEL[series.kind]}
              </span>
              {series.format && (
                <span className="text-faint">{series.format.replace(/_/g, " ")}</span>
              )}
              {series.year && <span className="text-faint">· {series.year}</span>}
              {series.mediaStatus && (
                <span className="text-faint">
                  · {series.mediaStatus.replace(/_/g, " ").toLowerCase()}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight md:text-4xl">
              {displayTitle(series.title)}
            </h1>
            {subTitle(series.title) && (
              <div className="mt-1 font-display text-sm text-muted">
                {subTitle(series.title)}
              </div>
            )}
            <div className="mt-2 text-xs text-faint">
              {isWatched(series.kind)
                ? [
                    series.episodes && `${series.episodes} episodes`,
                    series.studios?.length && series.studios.join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : [
                    series.chapters && `${series.chapters} chapters`,
                    series.volumes && `${series.volumes} volumes`,
                    series.authors?.length && `by ${series.authors.join(", ")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {series.genres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>

            {/* Action row */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!inLibrary ? (
                <button
                  onClick={addToLibrary}
                  className="flex items-center gap-2 rounded-lg bg-vermillion px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
                >
                  <BookmarkPlus size={16} /> Add to library
                </button>
              ) : (
                entry && (
                  <>
                    <button
                      onClick={() => openEdit(series.id)}
                      className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:border-vermillion/60"
                      style={{
                        borderColor: STATUS_COLOR[entry.status],
                        color: STATUS_COLOR[entry.status],
                      }}
                    >
                      {statusLabel(entry.status, series.kind)}
                      <Pencil size={13} className="opacity-60" />
                    </button>
                    <div className="flex items-center gap-1.5 text-sm text-muted">
                      <span>
                        {entry.progress}
                        {total ? ` / ${total}` : ""} {progressUnit(series.kind)}
                      </span>
                      {entry.status !== "completed" && (
                        <button
                          onClick={bumpProgress}
                          aria-label="+1"
                          className="rounded-md bg-ink-700 p-1.5 transition-colors hover:bg-vermillion hover:text-white"
                        >
                          <Plus size={13} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        db.entries.update(series.id, {
                          favorite: !entry.favorite,
                          updatedAt: Date.now(),
                        })
                      }
                      aria-label="Favorite"
                      className={`rounded-lg border border-line-strong p-2.5 transition-colors ${
                        entry.favorite
                          ? "border-vermillion/60 text-vermillion-bright"
                          : "text-faint hover:text-text"
                      }`}
                    >
                      <Heart size={16} fill={entry.favorite ? "currentColor" : "none"} />
                    </button>
                    <AddToListButton seriesId={series.id} />
                    <LinkToAniList series={series} />
                    <PushToAniList series={series} entry={entry} />
                  </>
                )
              )}
            </div>
          </div>

          {/* Scores */}
          <div className="flex shrink-0 items-start gap-4 md:flex-col md:pt-14">
            <button
              onClick={() => inLibrary && openEdit(series.id)}
              className="flex flex-col items-center"
              title={inLibrary ? "Edit your rating" : "Add to library to rate"}
            >
              <EnsoScore score={entry?.rating} size={104} label="Your score" />
            </button>
            {series.meanScore != null && (
              <div className="flex flex-col items-center pt-2 text-center md:pt-0">
                <span className="font-display text-lg text-mizu">
                  {(series.meanScore / 10).toFixed(1)}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-faint">
                  Community
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Synopsis */}
        {series.synopsis && (
          <section className="relative mt-10">
            <span className="kanji-watermark -top-4 right-0 text-[6rem]">粗筋</span>
            <h2 className="mb-3 font-display text-xl font-semibold">Synopsis</h2>
            <p
              className={`max-w-3xl whitespace-pre-line text-sm leading-relaxed text-text/85 ${
                expanded ? "" : "line-clamp-4"
              }`}
            >
              {series.synopsis}
            </p>
            {series.synopsis.length > 300 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-2 text-xs font-medium text-sakura hover:underline"
              >
                {expanded ? "Show less ▲" : "Read more ▼"}
              </button>
            )}
          </section>
        )}

        {/* Tags */}
        {!!series.tags.length && (
          <div className="mt-6 flex max-w-3xl flex-wrap gap-1.5">
            {series.tags.map((t) => (
              <span
                key={t.name}
                className="rounded-full bg-ink-800 px-2.5 py-1 text-[11px] text-faint"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Anime-Planet rating, tags & content warnings */}
        <ApInfoCard series={series} />

        <div className="torii-rule my-10 w-full opacity-60" />

        {/* Characters / relations / similar */}
        <ExtraSections seriesId={series.id} />

        {/* Chapters (manga kinds only) */}
        {!isWatched(series.kind) && (
          <div className="mt-10">
            <ChapterList series={series} />
          </div>
        )}

        <div className="torii-rule my-10 w-full opacity-60" />

        {/* Reviews + notes */}
        <div className="grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
          <ReviewSection seriesId={series.id} />
          <NotesSection seriesId={series.id} />
        </div>
      </div>

      <EditEntryModal />
    </div>
  );
}
