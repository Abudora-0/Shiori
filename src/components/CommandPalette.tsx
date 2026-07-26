"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Plus, Search as SearchIcon } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { useLibrary } from "@/lib/hooks";
import { displayTitle, formatRating, KIND_LABEL, statusShort } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";

/** Global quick search - Ctrl+K / Cmd+K from anywhere. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // Stay dormant (no DB subscription) until the palette is actually opened -
  // this is mounted globally, so an eager query here would re-run on every
  // library write anywhere in the app even while closed.
  const items = useLibrary(open);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    if (!items || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const scored = items
      .map((item) => {
        const titles = [
          item.series.title.english,
          item.series.title.romaji,
          item.series.title.native,
        ].filter(Boolean) as string[];
        let score = 0;
        for (const t of titles) {
          const lt = t.toLowerCase();
          if (lt === q) score = Math.max(score, 100);
          else if (lt.startsWith(q)) score = Math.max(score, 60);
          else if (lt.includes(q)) score = Math.max(score, 30);
        }
        return { item, score };
      })
      .filter((r) => r.score > 0);
    scored.sort(
      (a, b) => b.score - a.score || b.item.entry.updatedAt - a.item.entry.updatedAt
    );
    return scored.slice(0, 10).map((r) => r.item);
  }, [items, query]);

  function go(seriesId: number) {
    setOpen(false);
    router.push(`/series/${seriesId}`);
  }

  async function bump(seriesId: number, e: React.MouseEvent) {
    e.stopPropagation();
    const entry = await db.entries.get(seriesId);
    if (!entry) return;
    await db.entries.update(seriesId, {
      progress: entry.progress + 1,
      status: entry.status === "planning" ? "current" : entry.status,
      updatedAt: Date.now(),
    });
    await logActivity();
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      if (results[selected]) go(results[selected].series.id);
      else if (query.trim().length >= 2) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12dvh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-ink-850 shadow-2xl"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <SearchIcon size={17} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Jump to a series…"
                className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-faint"
              />
              <kbd className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-faint">
                esc
              </kbd>
            </div>

            {query.trim().length >= 2 && (
              <div className="max-h-[50dvh] overflow-y-auto py-1.5">
                {results.map((item, i) => (
                  <button
                    key={item.series.id}
                    onClick={() => go(item.series.id)}
                    onMouseEnter={() => setSelected(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                      i === selected ? "bg-ink-700" : ""
                    }`}
                  >
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded">
                      <Cover
                        src={item.series.cover}
                        alt=""
                        className="h-full w-full object-cover text-sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {displayTitle(item.series.title)}
                      </div>
                      <div className="text-[11px] text-faint">
                        {KIND_LABEL[item.series.kind]} ·{" "}
                        {statusShort(item.entry.status, item.series.kind)} · ch.{" "}
                        {item.entry.progress} · ★ {formatRating(item.entry.rating)}
                      </div>
                    </div>
                    {item.entry.status !== "completed" && (
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => bump(item.series.id, e)}
                        title="+1 progress"
                        className="shrink-0 rounded-md bg-ink-700 p-1.5 text-muted transition-colors hover:bg-vermillion hover:text-white"
                      >
                        <Plus size={13} strokeWidth={3} />
                      </span>
                    )}
                    {i === selected && (
                      <CornerDownLeft size={13} className="shrink-0 text-faint" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  }}
                  className="mt-1 flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-xs text-sakura hover:bg-ink-800"
                >
                  <SearchIcon size={13} /> Search AniList for “{query.trim()}”
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
