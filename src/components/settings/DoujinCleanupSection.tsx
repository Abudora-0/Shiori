"use client";

import { useState } from "react";
import { BookLock, Loader2, Trash2 } from "lucide-react";
import {
  findDoujinPollution,
  removeDoujinPollution,
  type DoujinPollutionEntry,
} from "@/lib/maintenance";
import { displayTitle } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";

export function DoujinCleanupSection() {
  const [found, setFound] = useState<DoujinPollutionEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function scan() {
    setBusy(true);
    setFound(await findDoujinPollution());
    setBusy(false);
  }

  async function removeAll() {
    if (!found?.length) return;
    if (
      !confirm(
        `Remove ${found.length} doujin entr${found.length === 1 ? "y" : "ies"} from your Library? They're already in the Annex if you've run the doujin backup import - this only removes the stray Library copies.`
      )
    ) {
      return;
    }
    setRemoving(true);
    await removeDoujinPollution(found.map((f) => f.series.id));
    setFound([]);
    setRemoving(false);
  }

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <BookLock size={17} className="text-mizu" /> Doujin cleanup
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Finds nhentai / HentaiFox / HentaiEra / Hitomi entries that ended up in
            your regular Library from an older backup import, before doujins were
            excluded and routed to the Annex only.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={busy}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-600 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <BookLock size={14} />}
          Scan
        </button>
      </div>

      {found !== null && (
        <div className="mt-4">
          {found.length === 0 ? (
            <p className="text-xs text-matcha">
              No doujin entries found in the regular Library.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted">
                  {found.length} found
                </p>
                <button
                  onClick={removeAll}
                  disabled={removing}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-vermillion px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-50"
                >
                  {removing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Remove all {found.length}
                </button>
              </div>
              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {found.map((f) => (
                  <div
                    key={f.series.id}
                    className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2"
                  >
                    <div className="h-9 w-6 shrink-0 overflow-hidden rounded">
                      <Cover
                        src={f.series.cover}
                        alt=""
                        className="h-full w-full object-cover text-xs"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {displayTitle(f.series.title)}
                      </div>
                      <div className="text-[10px] text-faint">
                        {f.series.sourceName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
