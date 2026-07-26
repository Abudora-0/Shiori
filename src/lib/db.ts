import Dexie, { type EntityTable } from "dexie";
import type {
  ActivityDay,
  CustomList,
  DoujinEntry,
  LibraryEntry,
  Note,
  Review,
  Series,
  SeriesExtra,
  Setting,
  UpdateCheck,
} from "./types";

export const db = new Dexie("shiori") as Dexie & {
  series: EntityTable<Series, "id">;
  entries: EntityTable<LibraryEntry, "seriesId">;
  reviews: EntityTable<Review, "id">;
  notes: EntityTable<Note, "id">;
  extras: EntityTable<SeriesExtra, "seriesId">;
  doujins: EntityTable<DoujinEntry, "id">;
  settings: EntityTable<Setting, "key">;
  lists: EntityTable<CustomList, "id">;
  activity: EntityTable<ActivityDay, "date">;
  updates: EntityTable<UpdateCheck, "seriesId">;
};

db.version(1).stores({
  series: "id, idMal, kind, year",
  entries: "seriesId, status, rating, updatedAt, favorite",
  reviews: "++id, seriesId, updatedAt",
  notes: "++id, seriesId, createdAt",
  extras: "seriesId, cachedAt",
  doujins: "++id, source, sourceId, favorite, addedAt",
  settings: "key",
});

db.version(2).stores({
  lists: "++id, updatedAt",
  activity: "date",
});

// v3: the Novel category was removed - fold existing entries into Manga
db.version(3).upgrade(async (tx) => {
  await tx
    .table("series")
    .toCollection()
    .modify((s: { kind: string }) => {
      if (s.kind === "NOVEL") s.kind = "MANGA";
    });
});

// v4: chapter-update checks for the Updates feed
db.version(4).stores({
  updates: "seriesId, checkedAt",
});

/** Bump today's activity counter - call on any library write worth counting. */
export async function logActivity(amount = 1): Promise<void> {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const row = await db.activity.get(date);
  if (row) await db.activity.update(date, { count: row.count + amount });
  else await db.activity.add({ date, count: amount });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
