"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { StatCounter } from "@/components/ui/StatCounter";
import { Heatmap } from "@/components/ui/Heatmap";
import { YearReview } from "@/components/stats/YearReview";
import { db } from "@/lib/db";
import { useLibrary } from "@/lib/hooks";
import {
  ALL_STATUSES,
  KIND_LABEL,
  statusLabel,
  STATUS_COLOR,
} from "@/lib/format";
import type { EntryStatus } from "@/lib/types";

const KIND_COLORS: Record<string, string> = {
  ANIME: "var(--mizu)",
  MANGA: "var(--vermillion)",
  MANHWA: "var(--sakura)",
  PORNHWA: "#e05299",
  MANHUA: "var(--gold)",
};

export default function StatsPage() {
  const items = useLibrary();

  // One-time seed of the heatmap from existing entry timestamps. Writes are
  // not allowed inside useLiveQuery (read-only transaction), so this runs in
  // an effect; the live query below then picks the rows up reactively.
  useEffect(() => {
    (async () => {
      try {
        if ((await db.activity.count()) > 0) return;
        const entries = await db.entries.toArray();
        if (entries.length === 0) return;
        const seed = new Map<string, number>();
        for (const e of entries) {
          for (const ts of [e.updatedAt, e.addedAt]) {
            const d = new Date(ts);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            seed.set(key, (seed.get(key) ?? 0) + 1);
          }
        }
        await db.activity.bulkPut(
          [...seed].map(([date, count]) => ({ date, count }))
        );
      } catch {
        // seeding is best-effort; the heatmap just starts empty
      }
    })();
  }, []);

  const activity = useLiveQuery(async () => {
    const rows = await db.activity.toArray();
    return new Map(rows.map((r) => [r.date, r.count]));
  }, []);

  const s = useMemo(() => {
    if (!items) return undefined;
    const anime = items.filter((i) => i.series.kind === "ANIME");
    const reading = items.filter((i) => i.series.kind !== "ANIME");
    const rated = items.filter((i) => (i.entry.rating ?? 0) > 0);

    const episodes = anime.reduce((t, i) => t + i.entry.progress, 0);
    const chapters = reading.reduce((t, i) => t + i.entry.progress, 0);
    const daysWatched = (episodes * 24) / 60 / 24;
    const mean =
      rated.length > 0
        ? rated.reduce((t, i) => t + i.entry.rating!, 0) / rated.length / 10
        : 0;

    // 10 buckets: 1–10
    const dist = Array.from({ length: 10 }, () => 0);
    for (const i of rated) {
      const bucket = Math.min(9, Math.max(0, Math.round(i.entry.rating! / 10) - 1));
      dist[bucket]++;
    }

    const genreCount = new Map<string, number>();
    for (const i of items)
      for (const g of i.series.genres)
        genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    const topGenres = [...genreCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const byStatus = new Map<EntryStatus, number>();
    for (const i of items)
      byStatus.set(i.entry.status, (byStatus.get(i.entry.status) ?? 0) + 1);

    const byKind = new Map<string, number>();
    for (const i of items)
      byKind.set(i.series.kind, (byKind.get(i.series.kind) ?? 0) + 1);

    return {
      total: items.length,
      episodes,
      chapters,
      daysWatched,
      mean,
      rated: rated.length,
      dist,
      topGenres,
      byStatus,
      byKind,
      completed: byStatus.get("completed") ?? 0,
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="統計"
        title="Statistics"
        subtitle="The shape of everything you've watched and read."
      />

      {!s ? null : s.total === 0 ? (
        <p className="py-20 text-center text-muted">
          Import or add some series first - the numbers will follow.
        </p>
      ) : (
        <div className="space-y-10 pb-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCounter value={s.total} label="Total series" />
            <StatCounter value={s.completed} label="Completed" />
            <StatCounter value={s.episodes} label="Episodes" />
            <StatCounter value={s.chapters} label="Chapters" />
            <StatCounter value={s.daysWatched} label="Days watched" decimals={1} />
            <StatCounter value={s.mean} label="Mean score" decimals={1} />
          </div>

          {/* Activity heatmap */}
          {activity && activity.size > 0 && (
            <section className="rounded-xl border border-line bg-ink-850 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Activity</h2>
              <Heatmap data={activity} />
            </section>
          )}

          <YearReview items={items} />

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Score distribution */}
            <section className="rounded-xl border border-line bg-ink-850 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">
                Score distribution
                <span className="ml-2 text-xs font-normal text-faint">
                  {s.rated} rated
                </span>
              </h2>
              <div className="flex h-40 items-end gap-1.5">
                {s.dist.map((count, i) => {
                  const max = Math.max(...s.dist, 1);
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] text-faint">{count || ""}</span>
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${(count / max) * 100}%`,
                          minHeight: count ? 4 : 1,
                          background: count
                            ? `linear-gradient(180deg, var(--gold), var(--vermillion-deep))`
                            : "var(--ink-700)",
                        }}
                      />
                      <span className="text-[10px] text-faint">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Status breakdown */}
            <section className="rounded-xl border border-line bg-ink-850 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">By status</h2>
              <div className="space-y-2.5">
                {ALL_STATUSES.map((st) => {
                  const count = s.byStatus.get(st) ?? 0;
                  const pct = (count / s.total) * 100;
                  return (
                    <div key={st}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted">{statusLabel(st, "ANIME")}</span>
                        <span className="text-faint">
                          {count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: STATUS_COLOR[st] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Kind donut */}
            <section className="rounded-xl border border-line bg-ink-850 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">By type</h2>
              <Donut data={[...s.byKind.entries()]} total={s.total} />
            </section>

            {/* Top genres */}
            <section className="rounded-xl border border-line bg-ink-850 p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Top genres</h2>
              <div className="space-y-2">
                {s.topGenres.map(([genre, count], i) => {
                  const max = s.topGenres[0][1];
                  return (
                    <div key={genre} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-xs text-muted">
                        {genre}
                      </span>
                      <div className="h-4 flex-1 overflow-hidden rounded-sm bg-ink-700">
                        <div
                          className="ink-stroke h-full"
                          style={{
                            width: `${(count / max) * 100}%`,
                            opacity: 1 - i * 0.06,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs text-faint">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({ data, total }: { data: [string, number][]; total: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
        {data.map(([kind, count]) => {
          const frac = count / total;
          const seg = (
            <circle
              key={kind}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={KIND_COLORS[kind] ?? "var(--ink-500)"}
              strokeWidth="14"
              strokeDasharray={`${Math.max(frac * circ - 1.5, 0.5)} ${circ}`}
              strokeDashoffset={-offset * circ}
            />
          );
          offset += frac;
          return seg;
        })}
      </svg>
      <div className="space-y-1.5">
        {data.map(([kind, count]) => (
          <div key={kind} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: KIND_COLORS[kind] ?? "var(--ink-500)" }}
            />
            <span className="text-muted">
              {KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind}
            </span>
            <span className="text-faint">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
