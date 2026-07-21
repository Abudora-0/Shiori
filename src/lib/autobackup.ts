import { db, getSetting, setSetting } from "./db";
import { exportBackup } from "./backup";

/**
 * Automatic backups via the File System Access API: the user picks a folder
 * once, we keep the handle in IndexedDB, and on app start (at most once per
 * ~20h) write shiori-auto-backup.json there. Not supported everywhere —
 * Brave ships with showDirectoryPicker disabled.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const HANDLE_KEY = "backupDirHandle";
const LAST_KEY = "lastAutoBackup";
const INTERVAL = 20 * 60 * 60 * 1000;

export function autoBackupSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseBackupFolder(): Promise<string> {
  const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
  await db.settings.put({ key: HANDLE_KEY, value: handle });
  await setSetting("autoBackupEnabled", true);
  await writeBackup(handle);
  await setSetting(LAST_KEY, Date.now());
  return handle.name as string;
}

export async function disableAutoBackup(): Promise<void> {
  await db.settings.delete(HANDLE_KEY);
  await setSetting("autoBackupEnabled", false);
}

export async function autoBackupStatus(): Promise<{
  enabled: boolean;
  folder?: string;
  last?: number;
}> {
  const handle = (await getSetting<any>(HANDLE_KEY)) as any;
  const enabled = (await getSetting<boolean>("autoBackupEnabled")) === true && !!handle;
  return {
    enabled,
    folder: handle?.name,
    last: await getSetting<number>(LAST_KEY),
  };
}

async function writeBackup(handle: any): Promise<void> {
  const backup = await exportBackup();
  const file = await handle.getFileHandle("shiori-auto-backup.json", {
    create: true,
  });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(backup));
  await writable.close();
}

/** Called on app start — silently skips unless due and permission persists. */
export async function runAutoBackupIfDue(): Promise<void> {
  try {
    if (!autoBackupSupported()) return;
    if ((await getSetting<boolean>("autoBackupEnabled")) !== true) return;
    const handle = (await getSetting<any>(HANDLE_KEY)) as any;
    if (!handle) return;
    const last = (await getSetting<number>(LAST_KEY)) ?? 0;
    if (Date.now() - last < INTERVAL) return;
    // Permission must still be granted from a prior session; we can't prompt
    // without a user gesture, so just skip quietly if it lapsed.
    const perm = await handle.queryPermission?.({ mode: "readwrite" });
    if (perm !== "granted") return;
    await writeBackup(handle);
    await setSetting(LAST_KEY, Date.now());
  } catch {
    /* best-effort */
  }
}
