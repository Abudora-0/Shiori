import { db, logActivity } from "./db";
import type { ImportedItem } from "./anilist";

export type MergeStrategy = "skip" | "overwrite";

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Write imported items into the library.
 * - Series metadata is always refreshed (it's a cache, not user data).
 * - "skip": existing library entries are left untouched, only new ones added.
 * - "overwrite": tracker data (status/progress/rating/dates) replaces local,
 *   but favorite flag, reviews and notes are always preserved.
 */
export async function mergeImport(
  items: ImportedItem[],
  strategy: MergeStrategy
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };

  await db.transaction("rw", db.series, db.entries, async () => {
    await db.series.bulkPut(items.map((i) => i.series));

    const existing = await db.entries.bulkGet(items.map((i) => i.entry.seriesId));

    const toPut = [];
    for (let i = 0; i < items.length; i++) {
      const incoming = items[i].entry;
      const current = existing[i];
      if (!current) {
        toPut.push(incoming);
        result.added++;
      } else if (strategy === "overwrite") {
        toPut.push({
          ...incoming,
          favorite: current.favorite,
          addedAt: current.addedAt,
        });
        result.updated++;
      } else {
        result.skipped++;
      }
    }
    await db.entries.bulkPut(toPut);
  });

  const changed = result.added + result.updated;
  if (changed > 0) await logActivity(changed);

  return result;
}
