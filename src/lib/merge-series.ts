import { db, logActivity } from "./db";
import { displayTitle } from "./format";
import type { LibraryEntry, Series } from "./types";

/**
 * Merge one library entry into another series (dedupe, or linking a local
 * Mihon entry to its AniList counterpart). Progress/dates take the best of
 * both; reviews, notes and list memberships migrate; the source entry and
 * its series record are deleted.
 */
export async function mergeSeries(fromId: number, into: Series): Promise<void> {
  await db.transaction(
    "rw",
    [db.series, db.entries, db.reviews, db.notes, db.extras, db.lists, db.updates],
    async () => {
      await db.series.put(into);

      const fromEntry = await db.entries.get(fromId);
      const intoEntry = await db.entries.get(into.id);
      if (fromEntry) {
        const merged: LibraryEntry = {
          seriesId: into.id,
          status: intoEntry?.status ?? fromEntry.status,
          progress: Math.max(intoEntry?.progress ?? 0, fromEntry.progress),
          progressVolumes:
            intoEntry?.progressVolumes ?? fromEntry.progressVolumes,
          rating: intoEntry?.rating ?? fromEntry.rating,
          startedAt: intoEntry?.startedAt ?? fromEntry.startedAt,
          finishedAt: intoEntry?.finishedAt ?? fromEntry.finishedAt,
          repeats: Math.max(intoEntry?.repeats ?? 0, fromEntry.repeats),
          favorite: (intoEntry?.favorite ?? false) || fromEntry.favorite,
          source: intoEntry?.source ?? fromEntry.source,
          addedAt: Math.min(
            intoEntry?.addedAt ?? Infinity,
            fromEntry.addedAt
          ),
          updatedAt: Date.now(),
        };
        await db.entries.put(merged);
        await db.entries.delete(fromId);
      }

      await db.reviews.where("seriesId").equals(fromId).modify({ seriesId: into.id });
      await db.notes.where("seriesId").equals(fromId).modify({ seriesId: into.id });

      const lists = await db.lists.toArray();
      for (const list of lists) {
        if (list.seriesIds.includes(fromId)) {
          const next = list.seriesIds
            .map((id) => (id === fromId ? into.id : id))
            .filter((id, i, arr) => arr.indexOf(id) === i);
          await db.lists.update(list.id!, { seriesIds: next, updatedAt: Date.now() });
        }
      }

      await db.extras.delete(fromId);
      await db.updates.delete(fromId);
      await db.series.delete(fromId);
    }
  );
  await logActivity();
}

export interface DupePair {
  a: { series: Series; entry: LibraryEntry };
  b: { series: Series; entry: LibraryEntry };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Exact normalized-title collisions across different series records. */
export async function findDuplicates(): Promise<DupePair[]> {
  const [entries, allSeries] = await Promise.all([
    db.entries.toArray(),
    db.series.toArray(),
  ]);
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));
  const items = entries
    .map((entry) => ({ entry, series: seriesById.get(entry.seriesId) }))
    .filter((x): x is { entry: LibraryEntry; series: Series } => !!x.series);

  const byTitle = new Map<string, typeof items>();
  for (const item of items) {
    const key = normalize(displayTitle(item.series.title));
    if (!key) continue;
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(item);
    else byTitle.set(key, [item]);
  }

  const pairs: DupePair[] = [];
  for (const bucket of byTitle.values()) {
    if (bucket.length < 2) continue;
    // Prefer showing canonical (AniList, id>0) as the merge target
    bucket.sort((x, y) => y.series.id - x.series.id);
    for (let i = 1; i < bucket.length; i++) {
      pairs.push({ a: bucket[i], b: bucket[0] });
    }
  }
  return pairs.slice(0, 100);
}
