"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BellRing, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { checkForUpdates } from "@/lib/updates";
import { displayTitle, formatDate, KIND_LABEL } from "@/lib/format";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { Cover } from "@/components/ui/Cover";

export default function UpdatesPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const rows = useLiveQuery(async () => {
    const updates = await db.updates.toArray();
    const withNew = updates.filter((u) => u.newCount > 0);
    const series = await db.series.bulkGet(withNew.map((u) => u.seriesId));
    const entries = await db.entries.bulkGet(withNew.map((u) => u.seriesId));
    return withNew
      .map((u, i) => ({ update: u, series: series[i], entry: entries[i] }))
      .filter((r) => r.series && r.entry)
      .sort((a, b) => b.update.newCount - a.update.newCount);
  }, []);

  const lastChecked = useLiveQuery(async () => {
    const all = await db.updates.orderBy("checkedAt").reverse().limit(1).toArray();
    return all[0]?.checkedAt;
  }, []);

  async function run() {
    setRunning(true);
    try {
      const result = await checkForUpdates((p) =>
        setStatus(
          `Checking ${p.count}/${p.total} (${p.found} with new chapters): ${p.current}`
        )
      );
      setStatus(
        `Done - ${result.checked} series checked, ${result.withNew} have new chapters` +
          (result.failed ? `, ${result.failed} failed` : "") +
          "."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    setRunning(false);
  }

  async function catchUp(seriesId: number, latest: number) {
    const entry = await db.entries.get(seriesId);
    if (!entry) return;
    await db.entries.update(seriesId, {
      progress: Math.max(entry.progress, Math.floor(latest)),
      updatedAt: Date.now(),
    });
    await db.updates.update(seriesId, { newCount: 0 });
    await logActivity();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="更新"
        title="Updates"
        subtitle="New chapters for everything you're reading, straight from the chapter sources."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-vermillion px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright disabled:opacity-50"
        >
          {running ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Check for updates
        </button>
        {lastChecked && !running && (
          <span className="text-xs text-faint">
            Last checked {formatDate(lastChecked)}
          </span>
        )}
      </div>
      {status && (
        <p className="mb-6 rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-xs text-muted">
          {status}
        </p>
      )}
      {running && (
        <p className="mb-6 text-xs text-faint">
          Each series takes a few seconds - leave this tab open; results appear
          below as they land.
        </p>
      )}

      {!rows ? null : rows.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <BellRing size={40} className="text-ink-600" />
          <p className="mt-4 max-w-sm text-sm text-muted">
            {lastChecked
              ? "All caught up - nothing new since the last check."
              : "Run a check to see which of your reading series have new chapters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line pb-0">
          {rows.map(({ update, series, entry }, i) => (
            <div
              key={series!.id}
              className={`flex items-center gap-4 px-4 py-3 ${
                i % 2 ? "bg-ink-900/60" : "bg-ink-850/60"
              }`}
            >
              <Link href={`/series/${series!.id}`} className="shrink-0">
                <div className="h-16 w-11 overflow-hidden rounded">
                  <Cover
                    src={series!.cover}
                    alt=""
                    className="h-full w-full object-cover text-base"
                  />
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/series/${series!.id}`}
                  className="block truncate text-sm font-medium hover:text-sakura"
                >
                  {displayTitle(series!.title)}
                </Link>
                <div className="mt-0.5 text-xs text-faint">
                  {KIND_LABEL[series!.kind]} · you&apos;re at ch. {entry!.progress} ·
                  latest ch. {update.latest}
                  {update.provider ? ` · via ${update.provider}` : ""}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-vermillion/15 px-2.5 py-1 text-xs font-bold text-vermillion-bright">
                +{update.newCount}
              </span>
              <button
                onClick={() => catchUp(series!.id, update.latest!)}
                title="Mark read up to latest"
                className="shrink-0 rounded-lg border border-line-strong p-2 text-faint transition-colors hover:border-matcha/60 hover:text-matcha"
              >
                <CheckCheck size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
