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
 * we need (proto2 syntax so presence of `favorite` is detectable - Mihon
 * defaults it to true and may omit it on the wire).
 *
 * Tracker syncIds: 1 = MyAnimeList, 2 = AniList, 3 = Kitsu.
 */

const SCHEMA = `
syntax = "proto2";
message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupSource backupSources = 101;
  // Aniyomi (manga+anime Mihon fork) extends the same container with an
  // anime side. Absent in a plain Tachiyomi/Mihon backup, in which case
  // these just decode as empty. Field numbers (501/503, not a tidy +200/+300
  // offset from the manga ones) confirmed by walking the raw wire format of
  // a real Aniyomi backup - the BackupAnime/BackupEpisode message shapes
  // below mirror BackupManga/BackupChapter's own field numbers exactly and
  // matched real decoded data (titles, thumbnail URLs, studio names, and
  // the anime entries' source ids resolving through backupAnimeSources).
  repeated BackupAnime backupAnime = 501;
  repeated BackupSource backupAnimeSources = 503;
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
message BackupAnime {
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
  repeated BackupEpisode episodes = 16;
  repeated BackupAnimeTracking tracking = 18;
  optional bool favorite = 100;
}
message BackupEpisode {
  optional string url = 1;
  optional string name = 2;
  optional bool seen = 4;
  optional bool bookmark = 5;
  optional int64 dateFetch = 7;
  optional int64 dateUpload = 8;
  optional float episodeNumber = 9;
  optional int64 sourceOrder = 10;
}
message BackupAnimeTracking {
  optional int32 syncId = 1;
  optional int64 libraryId = 2;
  optional string trackingUrl = 4;
  optional string title = 5;
  optional float lastEpisodeSeen = 6;
  optional int32 totalEpisodes = 7;
  optional float score = 8;
  optional int32 status = 9;
  optional int64 startedWatchingDate = 10;
  optional int64 finishedWatchingDate = 11;
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

export interface RawBackupAnime {
  source?: string;
  url?: string;
  title?: string;
  artist?: string;
  author?: string;
  description?: string;
  genre?: string[];
  thumbnailUrl?: string;
  episodes?: {
    seen?: boolean;
    episodeNumber?: number;
  }[];
  tracking?: {
    syncId?: number;
    score?: number;
    lastEpisodeSeen?: number;
    totalEpisodes?: number;
    mediaId?: string;
    startedWatchingDate?: string;
    finishedWatchingDate?: string;
  }[];
  favorite?: boolean;
}

export interface ParsedBackup {
  mangas: RawBackupManga[];
  /** sourceId (string) → extension name, e.g. "NHentai" */
  sources: Map<string, string>;
  /** Empty for a plain Tachiyomi/Mihon backup - only Aniyomi's fork has these. */
  animes: RawBackupAnime[];
  animeSources: Map<string, string>;
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
    backupAnime?: RawBackupAnime[];
    backupAnimeSources?: { name?: string; sourceId?: string }[];
  };
  const sources = new Map<string, string>();
  for (const s of obj.backupSources ?? []) {
    if (s.sourceId != null && s.name) sources.set(String(s.sourceId), s.name);
  }
  const animeSources = new Map<string, string>();
  for (const s of obj.backupAnimeSources ?? []) {
    if (s.sourceId != null && s.name) animeSources.set(String(s.sourceId), s.name);
  }
  return {
    mangas: obj.backupManga ?? [],
    sources,
    animes: obj.backupAnime ?? [],
    animeSources,
  };
}

/**
 * Extension names that host ONLY adult manhwa - safe to classify on name
 * alone. Mixed sites (Toonily, Hiperdex, ManhwaClan, NewToki…) carry plenty
 * of ordinary manhwa, so they only count as a "Korean" hint and still need
 * an adult genre tag to become Pornhwa.
 */
export const HARD_ADULT_SOURCES =
  /manhwa18|manytoon|manhwahentai|toongod|pornhwa|manga18|hentai/i;
const KOREAN_SOURCES =
  /toonily|hiperdex|manhwaclan|newtoki|manhwa|toon|webtoon/i;

export function guessKind(genres: string[], sourceName?: string): MediaKind {
  if (sourceName && HARD_ADULT_SOURCES.test(sourceName)) return "PORNHWA";
  const g = genres.map((x) => x.toLowerCase());
  const korean =
    g.some((x) => x.includes("manhwa") || x.includes("webtoon")) ||
    (!!sourceName && KOREAN_SOURCES.test(sourceName));
  // "mature"/"gore" are common on ordinary action manhwa - not adult markers
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

export function readProgress(m: RawBackupManga): number {
  let max = 0;
  for (const c of m.chapters ?? []) {
    if (c.read && (c.chapterNumber ?? 0) > max) max = c.chapterNumber!;
  }
  for (const t of m.tracking ?? []) {
    if ((t.lastChapterRead ?? 0) > max) max = t.lastChapterRead!;
  }
  return Math.floor(max);
}

function localAnimeSeries(a: RawBackupAnime, sourceName?: string): Series {
  return {
    id: localFallbackId(`aniyomi:${a.source ?? 0}:${a.url ?? a.title ?? ""}`),
    kind: "ANIME",
    sourceName,
    title: { romaji: a.title || "Untitled" },
    cover: a.thumbnailUrl,
    synopsis: a.description,
    genres: (a.genre ?? []).slice(0, 10),
    tags: [],
    format: "TV",
    episodes: a.episodes?.length || undefined,
    authors: [...new Set([a.author, a.artist].filter(Boolean))] as string[],
    cachedAt: Date.now(),
  };
}

export function readEpisodeProgress(a: RawBackupAnime): number {
  const episodes = a.episodes ?? [];
  let maxNumbered = 0;
  let seenCount = 0;
  for (const e of episodes) {
    if (!e.seen) continue;
    seenCount++;
    if ((e.episodeNumber ?? 0) > maxNumbered) maxNumbered = e.episodeNumber!;
  }
  for (const t of a.tracking ?? []) {
    if ((t.lastEpisodeSeen ?? 0) > maxNumbered) maxNumbered = t.lastEpisodeSeen!;
  }
  // Real numbered series: the highest seen episode number is the precise
  // signal. Single-video/movie-style entries (common on non-series sources)
  // carry a sentinel episode number (observed: -1) with no real ordinal, so
  // a seen-but-unnumbered episode would otherwise never register - fall
  // back to a plain count of seen episodes and take whichever is higher.
  return Math.floor(Math.max(maxNumbered, seenCount));
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
  const { mangas: allMangas, sources, animes: allAnimes, animeSources } =
    parseMihonBackup(buffer);
  // favorite === false → history-only entry; undefined means true (Kotlin default)
  const mangas = allMangas.filter((m) => m.favorite !== false && (m.title || m.url));
  // Empty for a plain Tachiyomi/Mihon backup - only present in Aniyomi's fork.
  const animes = allAnimes.filter((a) => a.favorite !== false && (a.title || a.url));
  const totalCount = mangas.length + animes.length;
  onProgress?.({ phase: "parsing", count: totalCount, total: totalCount });

  // Resolve via embedded tracker links first (AniList ids aren't type-specific;
  // MAL ids are resolved per media type since the same numeric id space is
  // reused between MAL anime and manga entries)
  const alIds: number[] = [];
  const malMangaIds: number[] = [];
  const malAnimeIds: number[] = [];
  for (const m of mangas) {
    const al = m.tracking?.find((t) => t.syncId === 2 && t.mediaId);
    const mal = m.tracking?.find((t) => t.syncId === 1 && t.mediaId);
    if (al) alIds.push(Number(al.mediaId));
    else if (mal) malMangaIds.push(Number(mal.mediaId));
  }
  for (const a of animes) {
    const al = a.tracking?.find((t) => t.syncId === 2 && t.mediaId);
    const mal = a.tracking?.find((t) => t.syncId === 1 && t.mediaId);
    if (al) alIds.push(Number(al.mediaId));
    else if (mal) malAnimeIds.push(Number(mal.mediaId));
  }
  onProgress?.({
    phase: "resolving",
    count: 0,
    total: alIds.length + malMangaIds.length + malAnimeIds.length,
  });
  const [byAl, byMalManga, byMalAnime] = await Promise.all([
    resolveByAniListIds([...new Set(alIds)]),
    resolveByMalIds([...new Set(malMangaIds)], "MANGA"),
    resolveByMalIds([...new Set(malAnimeIds)], "ANIME"),
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
        queries.push({ key: `m${i}`, title: m.title, type: "MANGA" });
      }
    });
    animes.forEach((a, i) => {
      const hasTracker = a.tracking?.some(
        (t) => (t.syncId === 2 || t.syncId === 1) && t.mediaId
      );
      if (!hasTracker && a.title) {
        queries.push({ key: `a${i}`, title: a.title, type: "ANIME" });
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
      (mal && byMalManga.get(Number(mal.mediaId))) ||
      titleMatches.get(`m${i}`) ||
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

  animes.forEach((a, i) => {
    const al = a.tracking?.find((t) => t.syncId === 2 && t.mediaId);
    const mal = a.tracking?.find((t) => t.syncId === 1 && t.mediaId);
    const series =
      (al && byAl.get(Number(al.mediaId))) ||
      (mal && byMalAnime.get(Number(mal.mediaId))) ||
      titleMatches.get(`a${i}`) ||
      localAnimeSeries(a, a.source ? animeSources.get(a.source) : undefined);

    const progress = readEpisodeProgress(a);
    const total = series.episodes ?? 0;
    const trackScore = a.tracking?.find((t) => (t.score ?? 0) > 0)?.score;
    const started = Number(
      a.tracking?.find((t) => Number(t.startedWatchingDate) > 0)?.startedWatchingDate ?? 0
    );
    const finished = Number(
      a.tracking?.find((t) => Number(t.finishedWatchingDate) > 0)?.finishedWatchingDate ?? 0
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
