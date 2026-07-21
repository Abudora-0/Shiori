"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { ALL_KINDS, ALL_STATUSES, formatDate, KIND_LABEL, statusLabel } from "@/lib/format";
import { describeSmart, matchSmart } from "@/lib/smartlist";
import { useLibrary, type LibraryItem } from "@/lib/hooks";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { Chip } from "@/components/ui/Chip";
import { Cover } from "@/components/ui/Cover";
import type { CustomList, EntryStatus, MediaKind, SmartFilter } from "@/lib/types";

export default function ListsPage() {
  const lists = useLiveQuery(
    () => db.lists.orderBy("updatedAt").reverse().toArray(),
    []
  );
  // Loaded once here and handed down — every smart list card and the smart
  // list builder need the full library, and each has its own useLibrary()
  // call otherwise: with N smart lists that's N+1 concurrent full-table
  // live-query subscriptions all re-scanning on every write anywhere in
  // entries/series.
  const items = useLibrary();
  const [name, setName] = useState("");

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    await db.lists.add({
      name: trimmed,
      seriesIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await logActivity();
    setName("");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="選集"
        title="Lists"
        subtitle="Curated shelves — favorites of favorites, seasonal watchlists, anything."
      />

      <div className="mb-8 max-w-2xl">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="New list name…"
            className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
          />
          <button
            onClick={create}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
          >
            <Plus size={15} /> Create
          </button>
        </div>
        <SmartListBuilder items={items} />
      </div>

      {!lists ? null : lists.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="font-display text-7xl text-ink-600">選</div>
          <p className="mt-4 text-sm text-muted">
            No lists yet — create one above, then add series from their pages.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function SmartListBuilder({ items }: { items: LibraryItem[] | undefined }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<MediaKind[]>([]);
  const [statuses, setStatuses] = useState<EntryStatus[]>([]);
  const [genre, setGenre] = useState("");
  const [minRating, setMinRating] = useState(0); // 10-point
  const [favorite, setFavorite] = useState(false);

  const genres = [
    ...new Set((items ?? []).flatMap((i) => i.series.genres)),
  ].sort();

  const filter: SmartFilter = {
    kinds: kinds.length ? kinds : undefined,
    statuses: statuses.length ? statuses : undefined,
    genre: genre || undefined,
    minRating: minRating > 0 ? minRating * 10 : undefined,
    favorite: favorite || undefined,
  };
  const matchCount = items?.filter((i) => matchSmart(filter, i)).length;

  const toggle = <T,>(arr: T[], v: T, set: (next: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function create() {
    if (!name.trim()) return;
    const now = Date.now();
    await db.lists.add({
      name: name.trim(),
      seriesIds: [],
      smart: filter,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity();
    setName("");
    setOpen(false);
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-sakura hover:underline"
      >
        <Sparkles size={13} /> {open ? "Hide smart list builder" : "Or create a smart list (auto-updating filter)"}
      </button>
      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-line bg-ink-850 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Smart list name…"
            className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
          />
          <div className="flex flex-wrap gap-1.5">
            {ALL_KINDS.map((k) => (
              <Chip key={k} active={kinds.includes(k)} onClick={() => toggle(kinds, k, setKinds)}>
                {KIND_LABEL[k]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_STATUSES.map((s) => (
              <Chip
                key={s}
                active={statuses.includes(s)}
                onClick={() => toggle(statuses, s, setStatuses)}
              >
                {statusLabel(s, "MANGA")}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="rounded-lg border border-line-strong bg-ink-900 px-3 py-1.5 text-sm outline-none focus:border-vermillion"
            >
              <option value="">Any genre</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-muted">
              Min rating
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-16 rounded-lg border border-line-strong bg-ink-900 px-2 py-1.5 text-sm outline-none focus:border-vermillion"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="accent-[var(--vermillion)]"
              />
              Favorites only
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-faint">
              {matchCount != null ? `${matchCount} series match right now` : ""}
            </span>
            <button
              onClick={create}
              disabled={!name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white hover:bg-vermillion-bright disabled:opacity-40"
            >
              <Sparkles size={14} /> Create smart list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListCard({
  list,
  items,
}: {
  list: CustomList;
  items: LibraryItem[] | undefined;
}) {
  const smartIds =
    list.smart && items
      ? items.filter((i) => matchSmart(list.smart!, i)).map((i) => i.series.id)
      : null;
  const memberIds = smartIds ?? list.seriesIds;

  const covers = useLiveQuery(async () => {
    const series = await db.series.bulkGet(memberIds.slice(0, 3));
    return series.filter(Boolean).map((s) => s!.cover);
  }, [memberIds.slice(0, 3).join(",")]);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    if (confirm(`Delete the list "${list.name}"? The series themselves stay in your library.`)) {
      await db.lists.delete(list.id!);
    }
  }

  return (
    <Link
      href={`/lists/${list.id}`}
      className="card-glow group flex gap-4 rounded-xl border border-line bg-ink-850 p-4"
    >
      <div className="flex h-24 w-20 shrink-0 items-center">
        {covers?.length ? (
          <div className="relative h-24 w-20">
            {covers.map((cover, i) => (
              <div
                key={i}
                className="absolute h-24 w-16 overflow-hidden rounded-md border border-ink-700 shadow-lg"
                style={{ left: i * 8, top: 0, zIndex: 3 - i, transform: `rotate(${i * 3 - 3}deg)` }}
              >
                <Cover src={cover} alt="" className="h-full w-full object-cover text-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-md border border-dashed border-line-strong font-display text-2xl text-faint">
            選
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-display text-lg font-semibold group-hover:text-white">
            {list.name}
          </div>
          {list.smart && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-sakura/15 px-2 py-0.5 text-[10px] font-medium text-sakura">
              <Sparkles size={10} /> Smart
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-faint">
          {memberIds.length} series · updated {formatDate(list.updatedAt)}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs text-muted">
          {list.smart ? describeSmart(list.smart) : list.description}
        </p>
      </div>
      <button
        onClick={remove}
        aria-label="Delete list"
        className="self-start rounded-md p-1.5 text-faint opacity-0 transition-opacity hover:bg-vermillion/10 hover:text-vermillion group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </Link>
  );
}
