import { db } from "./db";
import type { BackupFile } from "./types";

export async function exportBackup(): Promise<BackupFile> {
  const [series, entries, reviews, notes, extras, doujins, settings, lists, activity, updates] =
    await Promise.all([
      db.series.toArray(),
      db.entries.toArray(),
      db.reviews.toArray(),
      db.notes.toArray(),
      db.extras.toArray(),
      db.doujins.toArray(),
      db.settings.toArray(),
      db.lists.toArray(),
      db.activity.toArray(),
      db.updates.toArray(),
    ]);
  return {
    app: "shiori",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { series, entries, reviews, notes, extras, doujins, settings, lists, activity, updates },
  };
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shiori-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(json: unknown): Promise<void> {
  const backup = json as BackupFile;
  if (backup?.app !== "shiori" || backup.version !== 1 || !backup.data) {
    throw new Error("Not a valid Shiori backup file.");
  }
  const d = backup.data;
  // Older backups may still carry the removed Novel category
  for (const s of d.series ?? []) {
    if ((s.kind as string) === "NOVEL") s.kind = "MANGA";
  }
  await db.transaction(
    "rw",
    [db.series, db.entries, db.reviews, db.notes, db.extras, db.doujins, db.settings, db.lists, db.activity, db.updates],
    async () => {
      await Promise.all([
        db.series.bulkPut(d.series ?? []),
        db.entries.bulkPut(d.entries ?? []),
        db.reviews.bulkPut(d.reviews ?? []),
        db.notes.bulkPut(d.notes ?? []),
        db.extras.bulkPut(d.extras ?? []),
        db.doujins.bulkPut(d.doujins ?? []),
        db.settings.bulkPut(d.settings ?? []),
        db.lists.bulkPut(d.lists ?? []),
        db.activity.bulkPut(d.activity ?? []),
        db.updates.bulkPut(d.updates ?? []),
      ]);
    }
  );
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.series, db.entries, db.reviews, db.notes, db.extras, db.doujins, db.settings, db.lists, db.activity, db.updates],
    async () => {
      await Promise.all([
        db.series.clear(),
        db.entries.clear(),
        db.reviews.clear(),
        db.notes.clear(),
        db.extras.clear(),
        db.doujins.clear(),
        db.settings.clear(),
        db.lists.clear(),
        db.activity.clear(),
        db.updates.clear(),
      ]);
    }
  );
}
