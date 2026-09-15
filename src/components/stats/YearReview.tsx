"use client";

import { useMemo, useState } from "react";
import type { LibraryItem } from "@/lib/hooks";
import { kindLabel } from "@/lib/format";
import { useUiStore } from "@/lib/store";
import { Select } from "@/components/ui/Select";
import type { MediaKind } from "@/lib/types";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Yearly wrap-up: completions, taste vs community, monthly rhythm.
 * Takes `items` from the parent instead of its own useLibrary() call -
 * this is always mounted alongside the Stats page's own library query, so a
 * second live subscription here would double the re-scan work on every
 * library write while the page is open.
 */
export function YearReview({ items }: { items: LibraryItem[] | undefined }) {
  const matureRevealed = useUiStore((s) => s.matureRevealed);
  const [year, setYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const i of items ?? []) {
      if (i.entry.finishedAt) set.add(Number(i.entry.finishedAt.slice(0, 4)));
    }
    set.add(new Date().getFullYear());
    return [...set].filter((y) => y > 1990).sort((a, b) => b - a);
  }, [items]);

  const s = useMemo(() => {
    if (!items) return undefined;
    const finished = items.filter(
      (i) =>
        i.entry.status === "completed" &&
        i.entry.finishedAt?.startsWith(String(year))
    );
    const rated = finished.filter((i) => (i.entry.rating ?? 0) > 0);
    const mean =
      rated.length > 0
        ? rated.reduce((t, i) => t + i.entry.rating!, 0) / rated.length / 10
        : 0;
    const withCommunity = rated.filter((i) => i.series.meanScore != null);
    const vsCommunity =
      withCommunity.length > 0
        ? withCommunity.reduce(
            (t, i) => t + (i.entry.rating! - i.series.meanScore!),
            0
          ) /
          withCommunity.length /
          10
        : null;

    const byKind = new Map<string, number>();
    for (const i of finished)
      byKind.set(i.series.kind, (byKind.get(i.series.kind) ?? 0) + 1);

    const genres = new Map<string, number>();
    for (const i of finished)
      for (const g of i.series.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const monthly = Array.from({ length: 12 }, () => 0);
    for (const i of finished) {
      const m = Number(i.entry.finishedAt!.slice(5, 7));
      if (m >= 1 && m <= 12) monthly[m - 1]++;
    }
    const best = rated.slice().sort((a, b) => b.entry.rating! - a.entry.rating!)[0];

    return { finished, mean, vsCommunity, byKind, topGenres, monthly, best, rated };
  }, [items, year]);

  if (!s) return null;

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Year in review</h2>
        <Select
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          className="rounded-lg border border-line-strong bg-ink-900 px-3 py-1.5 text-sm"
        />
      </div>

      {s.finished.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">
          Nothing marked completed in {year} (finish dates drive this section).
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <Row label="Completed" value={String(s.finished.length)} />
            {[...s.byKind.entries()].map(([k, n]) => (
              <Row
                key={k}
                label={`· ${kindLabel(k as MediaKind, matureRevealed)}`}
                value={String(n)}
                muted
              />
            ))}
            <Row
              label="Your mean score"
              value={s.mean ? s.mean.toFixed(2) : "-"}
            />
            {s.vsCommunity != null && (
              <Row
                label="vs community"
                value={`${s.vsCommunity >= 0 ? "+" : ""}${s.vsCommunity.toFixed(2)} ${
                  s.vsCommunity >= 0 ? "(generous)" : "(harsher)"
                }`}
              />
            )}
            {s.best && (
              <Row
                label="Highest rated"
                value={`${
                  s.best.series.title.english ?? s.best.series.title.romaji ?? "-"
                } (${(s.best.entry.rating! / 10).toFixed(1)})`}
              />
            )}
            {!!s.topGenres.length && (
              <Row
                label="Top genres"
                value={s.topGenres.map(([g, n]) => `${g} ${n}`).join(" · ")}
              />
            )}
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-faint">
              Completions by month
            </div>
            <div className="flex h-28 items-end gap-1.5">
              {s.monthly.map((count, i) => {
                const max = Math.max(...s.monthly, 1);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-faint">{count || ""}</span>
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${(count / max) * 100}%`,
                        minHeight: count ? 4 : 1,
                        background: count
                          ? "linear-gradient(180deg, var(--sakura), var(--vermillion-deep))"
                          : "var(--ink-700)",
                      }}
                    />
                    <span className="text-[10px] text-faint">{MONTHS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={muted ? "text-xs text-faint" : "text-muted"}>{label}</span>
      <span className={`text-right ${muted ? "text-xs text-faint" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
