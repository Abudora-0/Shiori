"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Merge } from "lucide-react";
import { findDuplicates, mergeSeries, type DupePair } from "@/lib/merge-series";
import { displayTitle, KIND_LABEL } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";

export function DupeSection() {
  const [pairs, setPairs] = useState<DupePair[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [merging, setMerging] = useState<number | null>(null);

  async function scan() {
    setBusy(true);
    setPairs(await findDuplicates());
    setBusy(false);
  }

  async function merge(pair: DupePair, index: number) {
    setMerging(index);
    await mergeSeries(pair.a.series.id, pair.b.series);
    setPairs((p) => p?.filter((_, i) => i !== index) ?? null);
    setMerging(null);
  }

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Duplicate finder</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Finds entries with identical titles (usually a Mihon local copy next to
            its AniList version) and merges them - best progress wins, your rating,
            reviews, notes and list memberships all carry over.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={busy}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-600 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
          Scan
        </button>
      </div>

      {pairs !== null && (
        <div className="mt-4">
          {pairs.length === 0 ? (
            <p className="text-xs text-matcha">No duplicates found.</p>
          ) : (
            <div className="space-y-2">
              {pairs.map((pair, i) => (
                <div
                  key={`${pair.a.series.id}-${pair.b.series.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2"
                >
                  <MiniCard item={pair.a} />
                  <ArrowRight size={14} className="shrink-0 text-faint" />
                  <MiniCard item={pair.b} />
                  <button
                    onClick={() => merge(pair, i)}
                    disabled={merging !== null}
                    className="ml-auto shrink-0 rounded-lg bg-vermillion px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-50"
                  >
                    {merging === i ? "Merging…" : "Merge"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MiniCard({ item }: { item: DupePair["a"] }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-12 w-8 shrink-0 overflow-hidden rounded">
        <Cover src={item.series.cover} alt="" className="h-full w-full object-cover text-xs" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">
          {displayTitle(item.series.title)}
        </div>
        <div className="text-[10px] text-faint">
          {item.series.id > 0 ? "AniList" : "Local"} · {KIND_LABEL[item.series.kind]} ·
          ch. {item.entry.progress}
        </div>
      </div>
    </div>
  );
}
