"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { db, logActivity } from "@/lib/db";
import { useEntry, useSeries } from "@/lib/hooks";
import { useUiStore } from "@/lib/store";
import {
  ALL_KINDS,
  ALL_STATUSES,
  displayTitle,
  KIND_LABEL,
  maxProgress,
  statusLabel,
} from "@/lib/format";
import type { EntryStatus, MediaKind } from "@/lib/types";

/** Global edit modal — driven by useUiStore.editSeriesId. Mounted once in each page that needs it. */
export function EditEntryModal() {
  const seriesId = useUiStore((s) => s.editSeriesId);
  const close = useUiStore((s) => s.closeEdit);
  const series = useSeries(seriesId);
  const entry = useEntry(seriesId);

  const [status, setStatus] = useState<EntryStatus>("current");
  const [progress, setProgress] = useState(0);
  const [progressVolumes, setProgressVolumes] = useState<number | undefined>();
  const [rating, setRating] = useState(0); // 0–10 in 0.5 steps
  const [startedAt, setStartedAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [repeats, setRepeats] = useState(0);
  const [kind, setKind] = useState<MediaKind | null>(null);

  useEffect(() => {
    if (series) setKind(series.kind);
  }, [series]);

  useEffect(() => {
    if (entry) {
      setStatus(entry.status);
      setProgress(entry.progress);
      setProgressVolumes(entry.progressVolumes);
      setRating(entry.rating ? Math.round(entry.rating / 5) / 2 : 0);
      setStartedAt(entry.startedAt ?? "");
      setFinishedAt(entry.finishedAt ?? "");
      setRepeats(entry.repeats);
    }
  }, [entry]);

  if (seriesId == null) return null;

  const total = series ? maxProgress(series) : undefined;
  const isAnime = series?.kind === "ANIME";

  async function save() {
    if (!entry) return;
    if (series && kind && kind !== series.kind) {
      await db.series.update(series.id, { kind });
    }
    await db.entries.update(entry.seriesId, {
      status,
      progress,
      progressVolumes: progressVolumes || undefined,
      rating: rating > 0 ? Math.round(rating * 10) : undefined,
      startedAt: startedAt || undefined,
      finishedAt: finishedAt || undefined,
      repeats,
      updatedAt: Date.now(),
    });
    await logActivity();
    close();
  }

  async function removeEntry() {
    if (!entry) return;
    if (!confirm("Remove this entry from your library? Reviews and notes stay.")) return;
    await db.entries.delete(entry.seriesId);
    close();
  }

  return (
    <Modal
      open={seriesId != null && !!entry}
      onClose={close}
      title={series ? displayTitle(series.title) : "Edit"}
    >
      {series && entry && (
        <div className="space-y-5">
          {/* Status */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    status === s
                      ? "border-vermillion bg-vermillion/15 text-vermillion-bright"
                      : "border-line-strong bg-ink-800 text-muted hover:text-text"
                  }`}
                >
                  {statusLabel(s, series.kind)}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
                {isAnime ? "Episodes" : "Chapters"}
                {total ? ` / ${total}` : ""}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={total}
                  value={progress}
                  onChange={(e) => setProgress(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
                />
                <button
                  onClick={() => setProgress((p) => p + 1)}
                  className="rounded-lg bg-ink-700 px-3 py-2 text-sm font-bold hover:bg-ink-600"
                >
                  +1
                </button>
              </div>
            </div>
            {!isAnime ? (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
                  Volumes{series.volumes ? ` / ${series.volumes}` : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  value={progressVolumes ?? ""}
                  onChange={(e) =>
                    setProgressVolumes(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
                />
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
                  Rewatches
                </label>
                <input
                  type="number"
                  min={0}
                  value={repeats}
                  onChange={(e) => setRepeats(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
                />
              </div>
            )}
          </div>

          {/* Rating */}
          <div>
            <label className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-widest text-faint">
              <span>Rating</span>
              <span className="font-display text-xl normal-case tracking-normal text-gold">
                {rating > 0 ? rating.toFixed(1).replace(/\.0$/, "") : "—"}
                <span className="ml-1 text-xs text-faint">/ 10</span>
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full accent-[var(--gold)]"
            />
          </div>

          {/* Type override — imports use heuristics, fix mistakes here */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
              Type
            </label>
            <select
              value={kind ?? series.kind}
              onChange={(e) => setKind(e.target.value as MediaKind)}
              className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
            >
              {ALL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
                Started
              </label>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-faint">
                Finished
              </label>
              <input
                type="date"
                value={finishedAt}
                onChange={(e) => setFinishedAt(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-line pt-4">
            <button
              onClick={removeEntry}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-vermillion transition-colors hover:bg-vermillion/10"
            >
              <Trash2 size={15} /> Remove
            </button>
            <div className="flex gap-2">
              <button
                onClick={close}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-vermillion px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
