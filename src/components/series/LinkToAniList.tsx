"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Search as SearchIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Cover } from "@/components/ui/Cover";
import { searchAniList } from "@/lib/anilist";
import { mergeSeries } from "@/lib/merge-series";
import { displayTitle, KIND_LABEL } from "@/lib/format";
import type { Series } from "@/lib/types";

/** Local (Mihon/scraped) entries can be upgraded to their AniList record. */
export function LinkToAniList({ series }: { series: Series }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(displayTitle(series.title));
  const [results, setResults] = useState<Series[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const router = useRouter();

  if (series.id > 0) return null;

  async function search() {
    setBusy(true);
    try {
      setResults(await searchAniList(query, "MANGA"));
    } catch {
      setResults([]);
    }
    setBusy(false);
  }

  async function link(target: Series) {
    setLinking(target.id);
    await mergeSeries(series.id, target);
    setOpen(false);
    router.replace(`/series/${target.id}`);
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (!results) search();
        }}
        className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2.5 text-sm text-sakura transition-colors hover:border-sakura/60"
        title="Link this local entry to AniList for full metadata"
      >
        <Link2 size={15} /> Link to AniList
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Link to AniList" wide>
        <p className="mb-3 text-xs text-muted">
          Pick the matching AniList entry — your progress, rating, reviews and notes
          move over, and the series gains full metadata (characters, related,
          recommendations).
        </p>
        <div className="mb-4 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
          />
          <button
            onClick={search}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium hover:bg-ink-600 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SearchIcon size={14} />
            )}
            Search
          </button>
        </div>

        {busy ? null : results?.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">
            No AniList results — try a shorter or alternative title.
          </p>
        ) : (
          <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
            {results?.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2"
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
                  <Cover src={r.cover} alt="" className="h-full w-full object-cover text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {displayTitle(r.title)}
                  </div>
                  <div className="text-[11px] text-faint">
                    {KIND_LABEL[r.kind]}
                    {r.year ? ` · ${r.year}` : ""}
                    {r.chapters ? ` · ${r.chapters} ch` : ""}
                  </div>
                </div>
                <button
                  onClick={() => link(r)}
                  disabled={linking !== null}
                  className="shrink-0 rounded-lg bg-vermillion px-3 py-1.5 text-xs font-semibold text-white hover:bg-vermillion-bright disabled:opacity-50"
                >
                  {linking === r.id ? "Linking…" : "Link"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
