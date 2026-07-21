"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { LibraryEntry, Series } from "./types";

export interface LibraryItem {
  series: Series;
  entry: LibraryEntry;
}

/**
 * Full library joined: every entry with its series metadata.
 *
 * Pass `enabled: false` to skip the query entirely (e.g. a hidden panel that
 * hasn't been opened yet) — when the querier doesn't touch any table, Dexie's
 * liveQuery has nothing to observe, so it won't re-run on unrelated writes
 * elsewhere in the app. Flip back to `true` to resume live results.
 *
 * Joins via a full `series.toArray()` + Map rather than `bulkGet(ids)`: with
 * a library this size (1000+) a single table scan beats a thousand
 * individual key lookups, and since this whole function re-runs on every
 * write to either table anyway (Dexie has no incremental diffing), the join
 * strategy is the only lever we have to keep each re-run cheap.
 */
export function useLibrary(enabled = true): LibraryItem[] | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return undefined;
    const [entries, allSeries] = await Promise.all([
      db.entries.toArray(),
      db.series.toArray(),
    ]);
    const seriesById = new Map(allSeries.map((s) => [s.id, s]));
    const items: LibraryItem[] = [];
    for (const entry of entries) {
      const s = seriesById.get(entry.seriesId);
      if (s) items.push({ series: s, entry });
    }
    return items;
  }, [enabled]);
}

/** undefined = still loading, null = not in local db. */
export function useSeries(id: number | null): Series | undefined | null {
  return useLiveQuery(
    async () => (id == null ? null : ((await db.series.get(id)) ?? null)),
    [id]
  );
}

export function useEntry(seriesId: number | null): LibraryEntry | undefined | null {
  return useLiveQuery(
    async () =>
      seriesId == null ? null : ((await db.entries.get(seriesId)) ?? null),
    [seriesId]
  );
}

export function useReviews(seriesId: number) {
  return useLiveQuery(
    () => db.reviews.where("seriesId").equals(seriesId).reverse().sortBy("updatedAt"),
    [seriesId]
  );
}

export function useNotes(seriesId: number) {
  return useLiveQuery(
    () => db.notes.where("seriesId").equals(seriesId).reverse().sortBy("createdAt"),
    [seriesId]
  );
}

/** Set of seriesIds present in the library — used to badge "similar" cards. */
export function useLibraryIds(): Set<number> | undefined {
  return useLiveQuery(async () => {
    const keys = await db.entries.toCollection().primaryKeys();
    return new Set(keys as number[]);
  }, []);
}
