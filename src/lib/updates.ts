import { db } from "./db";
import { fetchChapters } from "./chapters";
import { displayTitle } from "./format";

/**
 * Updates feed — walks every manga-side series you're currently reading,
 * asks the chapter sources for the latest chapter, and records how many
 * chapters sit past your progress. Manual trigger (each series costs a few
 * scrape requests), results cached in the `updates` table.
 */

export interface UpdateProgress {
  count: number;
  total: number;
  current: string;
  found: number;
}

export interface UpdateRunResult {
  checked: number;
  withNew: number;
  failed: number;
}

export async function checkForUpdates(
  onProgress?: (p: UpdateProgress) => void
): Promise<UpdateRunResult> {
  const entries = await db.entries.where("status").equals("current").toArray();
  const series = await db.series.bulkGet(entries.map((e) => e.seriesId));

  const targets = entries
    .map((entry, i) => ({ entry, series: series[i] }))
    .filter((x) => x.series && x.series.kind !== "ANIME") as {
    entry: (typeof entries)[number];
    series: NonNullable<(typeof series)[number]>;
  }[];

  const result: UpdateRunResult = { checked: 0, withNew: 0, failed: 0 };

  for (let i = 0; i < targets.length; i++) {
    const { entry, series: s } = targets[i];
    onProgress?.({
      count: i + 1,
      total: targets.length,
      current: displayTitle(s.title),
      found: result.withNew,
    });
    try {
      const data = await fetchChapters(s);
      if (!data) {
        // No site matched this run — could be transient. Leave any
        // previously-recorded result alone rather than overwriting it with
        // a false "no new chapters".
        result.failed++;
        continue;
      }
      const latest = data.chapters.reduce(
        (max, c) => (c.number != null && c.number > max ? c.number : max),
        0
      );
      const newCount = latest > entry.progress ? Math.floor(latest - entry.progress) : 0;
      await db.updates.put({
        seriesId: s.id,
        latest: latest || undefined,
        newCount,
        provider: data.provider,
        checkedAt: Date.now(),
      });
      result.checked++;
      if (newCount > 0) result.withNew++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
