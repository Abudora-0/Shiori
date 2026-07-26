"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { displayTitle, formatRating, KIND_LABEL } from "@/lib/format";
import { describeSmart, matchSmart } from "@/lib/smartlist";
import { useLibrary } from "@/lib/hooks";
import { Cover } from "@/components/ui/Cover";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  // undefined = loading, null = no such list
  const list = useLiveQuery(
    async () =>
      Number.isFinite(id) ? ((await db.lists.get(id)) ?? null) : null,
    [id]
  );
  // Only smart lists need the full library join - skip it for manual lists
  const library = useLibrary(list === undefined || !!list?.smart);
  const manualItems = useLiveQuery(async () => {
    if (!list || list.smart) return undefined;
    const series = await db.series.bulkGet(list.seriesIds);
    const entries = await db.entries.bulkGet(list.seriesIds);
    return list.seriesIds
      .map((sid, i) => ({ series: series[i], entry: entries[i] }))
      .filter((x) => x.series);
  }, [list?.seriesIds.join(","), list?.smart != null]);

  const items = list?.smart
    ? library?.filter((i) => matchSmart(list.smart!, i))
    : manualItems;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (list === undefined) return null;
  if (list === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
        <p className="text-muted">This list doesn&apos;t exist (anymore).</p>
        <Link href="/lists" className="mt-4 inline-block text-sm text-sakura underline">
          Back to lists
        </Link>
      </div>
    );
  }

  function startEdit() {
    setName(list!.name);
    setDescription(list!.description ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    await db.lists.update(id, {
      name: name.trim() || list!.name,
      description: description.trim() || undefined,
      updatedAt: Date.now(),
    });
    setEditing(false);
  }

  async function removeList() {
    if (confirm(`Delete the list "${list!.name}"?`)) {
      await db.lists.delete(id);
      router.push("/lists");
    }
  }

  async function removeItem(seriesId: number) {
    await db.lists.update(id, {
      seriesIds: list!.seriesIds.filter((s) => s !== seriesId),
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <Link
        href="/lists"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-sakura"
      >
        <ArrowLeft size={13} /> All lists
      </Link>

      <div className="relative mb-8">
        <span className="kanji-watermark -top-6 left-0 text-[7rem]">選</span>
        {editing ? (
          <div className="relative z-10 max-w-lg space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 font-display text-2xl font-bold outline-none focus:border-vermillion"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 rounded-lg bg-vermillion px-4 py-1.5 text-sm font-semibold text-white hover:bg-vermillion-bright"
              >
                <Check size={14} /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:text-text"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative z-10 flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold md:text-4xl">{list.name}</h1>
              {list.smart && (
                <span className="flex items-center gap-1 rounded-full bg-sakura/15 px-2.5 py-1 text-xs font-medium text-sakura">
                  <Sparkles size={12} /> Smart
                </span>
              )}
              <button
                onClick={startEdit}
                aria-label="Rename list"
                className="rounded-md p-1.5 text-faint transition-colors hover:bg-ink-700 hover:text-text"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={removeList}
                aria-label="Delete list"
                className="rounded-md p-1.5 text-faint transition-colors hover:bg-vermillion/10 hover:text-vermillion"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="relative z-10 mt-2 text-sm text-muted">
              {list.smart
                ? describeSmart(list.smart)
                : list.description || `${list.seriesIds.length} series`}
            </p>
          </>
        )}
        <div className="torii-rule relative z-10 mt-5 w-44" />
      </div>

      {!items ? null : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="font-display text-6xl text-ink-600">空</div>
          <p className="mt-4 text-sm text-muted">
            Empty list - open any series page and use &quot;Add to list&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 pb-16 sm:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {items.map(({ series, entry }) => (
            <div key={series!.id} className="group relative">
              <Link href={`/series/${series!.id}`} className="block">
                <div className="card-glow relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800">
                  <Cover
                    src={series!.cover}
                    alt={displayTitle(series!.title)}
                    className="h-full w-full object-cover text-4xl transition-transform duration-500 group-hover:scale-105"
                  />
                  {entry?.rating != null && entry.rating > 0 && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-display text-[11px] text-gold backdrop-blur-sm">
                      {formatRating(entry.rating)}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 truncate text-[13px] font-medium text-text/90 group-hover:text-white">
                  {displayTitle(series!.title)}
                </div>
                <div className="text-[11px] text-faint">{KIND_LABEL[series!.kind]}</div>
              </Link>
              {!list.smart && (
                <button
                  onClick={() => removeItem(series!.id)}
                  aria-label="Remove from list"
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white/60 opacity-0 backdrop-blur-sm transition-opacity hover:text-vermillion-bright group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
