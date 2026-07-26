import { db, getSetting, setSetting } from "./db";
import { fetchChapters } from "./chapters";
import { displayTitle } from "./format";

/**
 * Updates feed - walks every manga-side series you're currently reading,
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
        // No site matched this run - could be transient. Leave any
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

/* ----- Auto-check on app start + browser notifications ----- */

const AUTO_ENABLED_KEY = "autoUpdateCheckEnabled";
const LAST_CHECK_KEY = "lastUpdateCheckAll";
const AUTO_INTERVAL = 12 * 60 * 60 * 1000;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Must be called from a user gesture (e.g. the Settings toggle's onChange) -
 * browsers ignore or block permission prompts fired without one.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function autoUpdateCheckStatus(): Promise<{
  enabled: boolean;
  last?: number;
  permission: NotificationPermission | "unsupported";
}> {
  return {
    enabled: (await getSetting<boolean>(AUTO_ENABLED_KEY)) === true,
    last: await getSetting<number>(LAST_CHECK_KEY),
    permission: notificationsSupported() ? Notification.permission : "unsupported",
  };
}

export async function setAutoUpdateCheck(enabled: boolean): Promise<void> {
  await setSetting(AUTO_ENABLED_KEY, enabled);
}

/** Called on app start - silently skips unless enabled and due. */
export async function runAutoUpdateCheckIfDue(): Promise<void> {
  try {
    if ((await getSetting<boolean>(AUTO_ENABLED_KEY)) !== true) return;
    const last = (await getSetting<number>(LAST_CHECK_KEY)) ?? 0;
    if (Date.now() - last < AUTO_INTERVAL) return;
    await setSetting(LAST_CHECK_KEY, Date.now());

    const result = await checkForUpdates();
    if (result.withNew > 0 && notificationsSupported() && Notification.permission === "granted") {
      new Notification("New chapters on Shiori", {
        body:
          result.withNew === 1
            ? "1 series has new chapters to read."
            : `${result.withNew} series have new chapters to read.`,
        icon: "/icons/ink.svg",
        tag: "shiori-updates",
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Live count of series with unread new chapters, for the nav badge. */
export async function unreadUpdateCount(): Promise<number> {
  return db.updates.filter((u) => u.newCount > 0).count();
}
