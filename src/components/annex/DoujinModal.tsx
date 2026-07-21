"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Heart, RefreshCw, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@/components/ui/Modal";
import { Cover } from "@/components/ui/Cover";
import { db } from "@/lib/db";
import { addDoujinByUrl } from "@/lib/doujin";
import { getSetting } from "@/lib/db";
import { formatDate } from "@/lib/format";

const SOURCE_LABEL = {
  nhentai: "nhentai",
  hentaifox: "HentaiFox",
  hentaiera: "HentaiEra",
  hitomi: "Hitomi",
  manual: "Manual",
};

export function DoujinModal({
  doujinId,
  onClose,
  onPickFilter,
}: {
  doujinId: number | null;
  onClose: () => void;
  onPickFilter: (kind: "tag" | "artist", value: string) => void;
}) {
  const doujin = useLiveQuery(
    () => (doujinId == null ? undefined : db.doujins.get(doujinId)),
    [doujinId]
  );

  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (doujin) {
      setRating(doujin.rating ? Math.round(doujin.rating / 5) / 2 : 0);
      setNotes(doujin.notes ?? "");
      setNotesDirty(false);
    }
  }, [doujin]);

  if (doujinId == null) return null;

  async function saveRating(v: number) {
    setRating(v);
    await db.doujins.update(doujinId!, {
      rating: v > 0 ? Math.round(v * 10) : undefined,
      updatedAt: Date.now(),
    });
  }

  async function saveNotes() {
    await db.doujins.update(doujinId!, {
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
    });
    setNotesDirty(false);
  }

  async function toggleFavorite() {
    if (!doujin) return;
    await db.doujins.update(doujinId!, {
      favorite: !doujin.favorite,
      updatedAt: Date.now(),
    });
  }

  async function remove() {
    if (confirm("Remove this entry from the annex?")) {
      await db.doujins.delete(doujinId!);
      onClose();
    }
  }

  async function refreshMeta() {
    if (!doujin?.url || doujin.source === "manual") return;
    setRefreshing(true);
    try {
      const cookie = await getSetting<string>("nhCookie");
      await addDoujinByUrl(doujin.url, cookie);
    } catch {
      /* best-effort refresh */
    }
    setRefreshing(false);
  }

  const pick = (kind: "tag" | "artist") => (value: string) => {
    onPickFilter(kind, value);
    onClose();
  };

  return (
    <Modal open={doujinId != null && !!doujin} onClose={onClose} title={doujin?.title} wide>
      {doujin && (
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="w-40 shrink-0 self-start">
            <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line">
              <Cover src={doujin.cover} alt="" className="h-full w-full object-cover text-3xl" />
            </div>
            <div className="mt-3 flex justify-between">
              <button
                onClick={toggleFavorite}
                className={`rounded-lg border border-line-strong p-2 transition-colors ${
                  doujin.favorite ? "border-vermillion/60 text-vermillion-bright" : "text-faint hover:text-text"
                }`}
                aria-label="Favorite"
              >
                <Heart size={15} fill={doujin.favorite ? "currentColor" : "none"} />
              </button>
              {doujin.url && (
                <a
                  href={doujin.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-xs text-muted transition-colors hover:border-vermillion/60 hover:text-text"
                >
                  Open <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {doujin.titleNative && (
              <p className="-mt-1 font-display text-sm text-muted">{doujin.titleNative}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
              <span>{SOURCE_LABEL[doujin.source]} #{doujin.sourceId}</span>
              {doujin.language && <span className="capitalize">{doujin.language}</span>}
              {doujin.pages && <span>{doujin.pages} pages</span>}
              <span>added {formatDate(doujin.addedAt)}</span>
            </div>

            {!!doujin.artists.length && (
              <ChipRow label="Artists" items={doujin.artists} accent onPick={pick("artist")} />
            )}
            {!!doujin.groups?.length && <ChipRow label="Groups" items={doujin.groups} />}
            {!!doujin.parodies?.length && <ChipRow label="Parodies" items={doujin.parodies} />}
            {!!doujin.characters?.length && (
              <ChipRow label="Characters" items={doujin.characters} />
            )}
            {!!doujin.tags.length && (
              <ChipRow label="Tags" items={doujin.tags} onPick={pick("tag")} />
            )}

            {/* Rating */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-faint">
                  Rating
                </span>
                <span className="font-display text-lg text-gold">
                  {rating > 0 ? rating.toFixed(1).replace(/\.0$/, "") : "—"}
                  <span className="ml-1 text-xs text-faint">/ 10</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={rating}
                onChange={(e) => saveRating(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
              />
            </div>

            {/* Notes */}
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-faint">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesDirty(true);
                }}
                rows={3}
                placeholder="Private notes…"
                className="w-full resize-y rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
              />
              {notesDirty && (
                <button
                  onClick={saveNotes}
                  className="mt-1.5 rounded-lg bg-vermillion px-4 py-1.5 text-xs font-semibold text-white hover:bg-vermillion-bright"
                >
                  Save notes
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <button
                onClick={remove}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-vermillion transition-colors hover:bg-vermillion/10"
              >
                <Trash2 size={13} /> Remove
              </button>
              {doujin.source !== "manual" && (
                <button
                  onClick={refreshMeta}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-faint transition-colors hover:text-text disabled:opacity-50"
                >
                  <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                  Refresh metadata
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ChipRow({
  label,
  items,
  accent,
  onPick,
}: {
  label: string;
  items: string[];
  accent?: boolean;
  onPick?: (value: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-faint">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const cls = `rounded-full px-2.5 py-1 text-[11px] transition-colors ${
            accent
              ? "bg-vermillion/15 text-vermillion-bright"
              : "bg-ink-800 text-muted"
          } ${onPick ? "cursor-pointer hover:bg-vermillion/25 hover:text-text" : ""}`;
          return onPick ? (
            <button key={item} onClick={() => onPick(item)} className={cls}>
              {item}
            </button>
          ) : (
            <span key={item} className={cls}>
              {item}
            </span>
          );
        })}
      </div>
    </div>
  );
}
