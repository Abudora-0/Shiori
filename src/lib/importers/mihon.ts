import pako from "pako";
import protobuf from "protobufjs";
import type { LibraryEntry, MediaKind, Series } from "../types";
import type { ImportedItem } from "../anilist";
import { resolveByAniListIds, resolveByMalIds } from "../anilist";
import { matchTitles, type TitleQuery } from "../title-match";
import { localFallbackId } from "../ids";

/**
 * Mihon / Tachiyomi-fork backup importer.
 * .tachibk / .proto.gz files are gzipped protobuf. We decode only the fields
 * we need (proto2 syntax so presence of `favorite` is detectable — Mihon
 * defaults it to true and may omit it on the wire).
 *
 * Tracker syncIds: 1 = MyAnimeList, 2 = AniList, 3 = Kitsu.
 */

const SCHEMA = `
syntax = "proto2";
message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupSource backupSources = 101;
}
message BackupSource {
  optional string name = 1;
  optional int64 sourceId = 2;
}
message BackupManga {
  optional int64 source = 1;
  optional string url = 2;
  optional string title = 3;
  optional string artist = 4;
  optional string author = 5;
  optional string description = 6;
  repeated string genre = 7;
  optional int32 status = 8;
  optional string thumbnailUrl = 9;
  optional int64 dateAdded = 13;
  repeated BackupChapter chapters = 16;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100;
}
message BackupChapter {
  optional string url = 1;
  optional string name = 2;
  optional string scanlator = 3;
  optional bool read = 4;
  optional bool bookmark = 5;
  optional int64 lastPageRead = 6;
  optional int64 dateFetch = 7;
  optional int64 dateUpload = 8;
  optional float chapterNumber = 9;
  optional int64 sourceOrder = 10;
}
message BackupTracking {
  optional int32 syncId = 1;
  optional int64 libraryId = 2;
  optional string trackingUrl = 4;
  optional string title = 5;
  optional float lastChapterRead = 6;
  optional int32 totalChapters = 7;
  optional float score = 8;
  optional int32 status = 9;
  optional int64 startedReadingDate = 10;
  optional int64 finishedReadingDate = 11;
  optional int64 mediaId = 100;
}
`;

export interface RawBackupManga {
  /** int64 decoded as string to keep 64-bit source ids precise */
  source?: string;
  url?: string;
  title?: string;
  artist?: string;
  author?: string;
  description?: string;
  genre?: string[];
  thumbnailUrl?: string;
  chapters?: {
    read?: boolean;
    chapterNumber?: number;
  }[];
  tracking?: {
    syncId?: number;
    score?: number;
    lastChapterRead?: number;
    totalChapters?: number;
    mediaId?: string;
    startedReadingDate?: string;
    finishedReadingDate?: string;
  }[];
  favorite?: boolean;
}

export interface ParsedBackup {
  mangas: RawBackupManga[];
  /** sourceId (string) → extension name, e.g. "NHentai" */
  sources: Map<string, string>;
}

export function parseMihonBackup(buffer: ArrayBuffer | Uint8Array): ParsedBackup {
  let bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // gzip magic
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = pako.ungzip(bytes);
  }
  const root = protobuf.parse(SCHEMA).root;
  const Backup = root.lookupType("Backup");
  const decoded = Backup.decode(bytes);
  const obj = Backup.toObject(decoded, { longs: String, defaults: false }) as {
    backupManga?: RawBackupManga[];
    backupSources?: { name?: string; sourceId?: string }[];
  };
  const sources = new Map<string, string>();
  for (const s of obj.backupSources ?? []) {
    if (s.sourceId != null && s.name) sources.set(String(s.sourceId), s.name);
  }
  return { mangas: obj.backupManga ?? [], sources };
}

/**
 * Extension names that host ONLY adult manhwa — safe to classify on name
 * alone. Mixed sites (Toonily, Hiperdex, ManhwaClan, NewToki…) carry plenty
 * of ordinary manhwa, so they only count as a "Korean" hint and still need
 * an adult genre tag to become Pornhwa.
 */
export const HARD_ADULT_SOURCES =
  /manhwa18|manytoon|manhwahentai|toongod|pornhwa|manga18|hentai/i;
const KOREAN_SOURCES =
  /toonily|hiperdex|manhwaclan|newtoki|manhwa|toon|webtoon/i;

function guessKind(genres: string[], sourceName?: string): MediaKind {
  if (sourceName && HARD_ADULT_SOURCES.test(sourceName)) return "PORNHWA";
  const g = genres.map((x) => x.toLowerCase());
  const korean =
    g.some((x) => x.includes("manhwa") || x.includes("webtoon")) ||
    (!!sourceName && KOREAN_SOURCES.test(sourceName));
  // "mature"/"gore" are common on ordinary action manhwa — not adult markers
  const adult = g.some(
    (x) =>
      x.includes("adult") ||
      x.includes("smut") ||
      x.includes("hentai") ||
      x.includes("18+") ||
      x.includes("erotica")
  );
  if (korean) return adult ? "PORNHWA" : "MANHWA";
  if (g.some((x) => x.includes("manhua"))) return "MANHUA";
  return "MANGA";
}

function localSeries(m: RawBackupManga, sourceName?: string): Series {
  return {
    id: localFallbackId(`mihon:${m.source ?? 0}:${m.url ?? m.title ?? ""}`),
    kind: guessKind(m.genre ?? [], sourceName),
    sourceName,
    title: { romaji: m.title || "Untitled" },
    cover: m.thumbnailUrl,
    synopsis: m.description,
    genres: (m.genre ?? []).slice(0, 10),
    tags: [],
    format: "MANGA",
    chapters: m.chapters?.length || undefined,
    authors: [...new Set([m.author, m.artist].filter(Boolean))] as string[],
    cachedAt: Date.now(),
  };
}

function readProgress(m: RawBackupManga): number {
  let max = 0;
  for (const c of m.chapters ?? []) {
    if (c.read && (c.chapterNumber ?? 0) > max) max = c.chapterNumber!;
  }
  for (const t of m.tracking ?? []) {
    if ((t.lastChapterRead ?? 0) > max) max = t.lastChapterRead!;
  }
  return Math.floor(max);
}

export interface MihonProgress {
  phase: "parsing" | "resolving" | "matching";
  count: number;
  total: number;
}

export async function importMihonBackup(
  buffer: ArrayBuffer,
  options: { matchByTitle: boolean },
  onProgress?: (p: MihonProgress) => void
): Promise<ImportedItem[]> {
  const { mangas: all, sources } = parseMihonBackup(buffer);
  // favorite === false → history-only entry; undefined means true (Kotlin default)
  const mangas = all.filter((m) => m.favorite !== false && (m.title || m.url));
  onProgress?.({ phase: "parsing", count: mangas.length, total: mangas.length });

  // Resolve via embedded tracker links first
  const alIds: number[] = [];
  const malIds: number[] = [];
  for (const m of mangas) {
    const al = m.tracking?.find((t) => t.syncId === 2 && t.mediaId);
    const mal = m.tracking?.find((t) => t.syncId === 1 && t.mediaId);
    if (al) alIds.push(Number(al.mediaId));
    else if (mal) malIds.push(Number(mal.mediaId));
  }
  onProgress?.({ phase: "resolving", count: 0, total: alIds.length + malIds.length });
  const [byAl, byMal] = await Promise.all([
    resolveByAniListIds([...new Set(alIds)]),
    resolveByMalIds([...new Set(malIds)], "MANGA"),
  ]);

  // Optionally match the rest by title
  const titleMatches = new Map<string, Series>();
  if (options.matchByTitle) {
    const queries: TitleQuery[] = [];
    mangas.forEach((m, i) => {
      const hasTracker = m.tracking?.some(
        (t) => (t.syncId === 2 || t.syncId === 1) && t.mediaId
      );
      if (!hasTracker && m.title) {
        queries.push({ key: String(i), title: m.title, type: "MANGA" });
      }
    });
    if (queries.length) {
      const matched = await matchTitles(queries, (done, total) =>
        onProgress?.({ phase: "matching", count: done, total })
      );
      for (const [k, v] of matched) titleMatches.set(k, v);
    }
  }

  const now = Date.now();
  const items: ImportedItem[] = [];
  mangas.forEach((m, i) => {
    const al = m.tracking?.find((t) => t.syncId === 2 && t.mediaId);
    const mal = m.tracking?.find((t) => t.syncId === 1 && t.mediaId);
    const series =
      (al && byAl.get(Number(al.mediaId))) ||
      (mal && byMal.get(Number(mal.mediaId))) ||
      titleMatches.get(String(i)) ||
      localSeries(m, m.source ? sources.get(m.source) : undefined);

    const progress = readProgress(m);
    const total = series.chapters ?? 0;
    const trackScore = m.tracking?.find((t) => (t.score ?? 0) > 0)?.score;
    const started = Number(
      m.tracking?.find((t) => Number(t.startedReadingDate) > 0)?.startedReadingDate ?? 0
    );
    const finished = Number(
      m.tracking?.find((t) => Number(t.finishedReadingDate) > 0)?.finishedReadingDate ?? 0
    );

    const entry: LibraryEntry = {
      seriesId: series.id,
      status:
        total > 0 && progress >= total
          ? "completed"
          : progress > 0
            ? "current"
            : "planning",
      progress,
      rating: trackScore ? Math.round(trackScore * 10) : undefined,
      startedAt: started ? new Date(started).toISOString().slice(0, 10) : undefined,
      finishedAt: finished ? new Date(finished).toISOString().slice(0, 10) : undefined,
      repeats: 0,
      favorite: false,
      source: "mihon",
      addedAt: now,
      updatedAt: now,
    };
    items.push({ series, entry });
  });
  return items;
}
