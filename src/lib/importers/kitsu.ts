import type { EntryStatus, LibraryEntry, Series } from "../types";
import type { ImportedItem } from "../anilist";
import { resolveByAniListIds, resolveByMalIds } from "../anilist";
import { kitsuAnimeFallbackId, kitsuMangaFallbackId } from "../ids";

/**
 * Kitsu importer - public JSON:API, no auth, CORS-enabled.
 * Library entries are resolved to AniList series via Kitsu's media "mappings"
 * (anilist id preferred, then MAL id); otherwise a Kitsu-only series is kept.
 */

const API = "https://kitsu.io/api/edge";
const HEADERS = {
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
};

interface KitsuMediaAttr {
  canonicalTitle?: string;
  titles?: { en?: string; en_jp?: string; ja_jp?: string };
  synopsis?: string;
  posterImage?: { original?: string; large?: string };
  subtype?: string;
  status?: string;
  episodeCount?: number;
  chapterCount?: number;
  volumeCount?: number;
  averageRating?: string;
  startDate?: string;
  ageRating?: string;
}

interface KitsuResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string }[] | { id: string; type: string } }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries on a bare network/CORS failure (fetch() rejecting outright) - this
 * is how Cloudflare-fronted APIs typically present rate-limiting to the
 * browser: no readable status code, just an uncatchable "Failed to fetch"
 * (same quirk documented on AniList's gql() queue).
 */
async function kitsuGet(url: string): Promise<{ data: KitsuResource[]; included?: KitsuResource[]; links?: { next?: string } }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "5") * 1000;
      await sleep(retryAfter);
      continue;
    }
    if (!res.ok) throw new Error(`Kitsu error (${res.status}).`);
    return res.json();
  }
  throw new Error("Kitsu is rate-limiting right now - wait a bit and try again.");
}

async function userIdExists(id: string): Promise<boolean> {
  const res = await fetch(`${API}/users/${id}?fields[users]=name`, { headers: HEADERS });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Kitsu error (${res.status}).`);
  const json = (await res.json()) as { data?: unknown };
  return !!json.data;
}

async function findUserId(username: string): Promise<string> {
  // A bare numeric id (from the user's profile URL or API response) sidesteps
  // slug/name lookup entirely - useful since display names aren't unique and
  // not everyone has a slug set.
  if (/^\d+$/.test(username)) {
    if (await userIdExists(username)) return username;
    throw new Error(`No Kitsu user with id ${username}.`);
  }

  for (const filter of ["slug", "name"]) {
    const json = await kitsuGet(
      `${API}/users?filter[${filter}]=${encodeURIComponent(username)}&fields[users]=name,slug`
    );
    if (json.data.length === 1) return json.data[0].id;
    if (json.data.length > 1) {
      // Display names aren't unique on Kitsu (unlike slugs) - guessing which
      // account is "yours" risks silently importing a stranger's library.
      throw new Error(
        `Multiple Kitsu accounts are named "${username}" - use your exact profile slug ` +
          `instead (the part after kitsu.io/users/ on your profile page).`
      );
    }
  }
  throw new Error(`Kitsu user "${username}" not found.`);
}

function mapKitsuStatus(s: string): EntryStatus {
  switch (s) {
    case "current":
      return "current";
    case "completed":
      return "completed";
    case "on_hold":
      return "paused";
    case "dropped":
      return "dropped";
    default:
      return "planning";
  }
}

function kitsuMediaToSeries(media: KitsuResource, kind: "anime" | "manga"): Series {
  const a = media.attributes as KitsuMediaAttr;
  const subtype = (a.subtype ?? "").toLowerCase();
  return {
    id:
      kind === "anime"
        ? kitsuAnimeFallbackId(Number(media.id))
        : kitsuMangaFallbackId(Number(media.id)),
    kind:
      kind === "anime"
        ? (a.ageRating === "R18" ? "HENTAI" : "ANIME")
        : subtype === "manhwa"
          ? (a.ageRating === "R18" ? "PORNHWA" : "MANHWA")
          : subtype === "manhua"
            ? "MANHUA"
            : "MANGA",
    title: {
      romaji: a.titles?.en_jp || a.canonicalTitle,
      english: a.titles?.en || undefined,
      native: a.titles?.ja_jp || undefined,
    },
    cover: a.posterImage?.large || a.posterImage?.original,
    synopsis: a.synopsis,
    genres: [],
    tags: [],
    format: a.subtype?.toUpperCase(),
    mediaStatus: a.status?.toUpperCase(),
    episodes: a.episodeCount ?? undefined,
    chapters: a.chapterCount ?? undefined,
    volumes: a.volumeCount ?? undefined,
    meanScore: a.averageRating ? Math.round(Number(a.averageRating)) : undefined,
    year: a.startDate ? Number(a.startDate.slice(0, 4)) : undefined,
    countryOfOrigin: subtype === "manhwa" ? "KR" : subtype === "manhua" ? "CN" : "JP",
    cachedAt: Date.now(),
  };
}

export interface KitsuProgress {
  phase: "fetching" | "resolving";
  count: number;
}

export async function fetchKitsuUserList(
  username: string,
  kind: "anime" | "manga",
  onProgress?: (p: KitsuProgress) => void
): Promise<ImportedItem[]> {
  const userId = await findUserId(username);

  // Page through library entries with media + mappings included
  const entries: KitsuResource[] = [];
  const included = new Map<string, KitsuResource>();
  let url =
    `${API}/library-entries?filter[userId]=${userId}&filter[kind]=${kind}` +
    `&include=media,media.mappings` +
    `&fields[libraryEntries]=status,progress,progressedAt,ratingTwenty,startedAt,finishedAt,reconsumeCount,media` +
    `&page[limit]=500`;
  for (;;) {
    const json = await kitsuGet(url);
    entries.push(...json.data);
    for (const inc of json.included ?? []) included.set(`${inc.type}:${inc.id}`, inc);
    onProgress?.({ phase: "fetching", count: entries.length });
    if (!json.links?.next) break;
    url = json.links.next;
    await sleep(300);
  }

  // Collect external ids from mappings
  onProgress?.({ phase: "resolving", count: entries.length });
  const mediaType = kind === "anime" ? "anime" : "manga";
  const wanted = kind === "anime" ? "ANIME" : "MANGA";

  interface Row {
    entry: KitsuResource;
    media?: KitsuResource;
    anilistId?: number;
    malId?: number;
  }
  const rows: Row[] = [];
  for (const e of entries) {
    const rel = e.relationships?.media?.data;
    const mediaRef = Array.isArray(rel) ? rel[0] : rel;
    const media = mediaRef ? included.get(`${mediaRef.type}:${mediaRef.id}`) : undefined;
    const row: Row = { entry: e, media };
    const mapRel = media?.relationships?.mappings?.data;
    const mapRefs = Array.isArray(mapRel) ? mapRel : mapRel ? [mapRel] : [];
    for (const ref of mapRefs) {
      const m = included.get(`${ref.type}:${ref.id}`);
      const site = String(m?.attributes?.externalSite ?? "");
      const extId = String(m?.attributes?.externalId ?? "");
      const num = Number(extId.replace(/\D+/g, ""));
      if (!num) continue;
      if (site === `anilist/${mediaType}` || site === "anilist") row.anilistId = num;
      if (site === `myanimelist/${mediaType}`) row.malId = num;
    }
    rows.push(row);
  }

  const [byAl, byMal] = await Promise.all([
    resolveByAniListIds([...new Set(rows.filter((r) => r.anilistId).map((r) => r.anilistId!))]),
    resolveByMalIds(
      [...new Set(rows.filter((r) => !r.anilistId && r.malId).map((r) => r.malId!))],
      wanted
    ),
  ]);

  const now = Date.now();
  const items: ImportedItem[] = [];
  for (const row of rows) {
    if (!row.media) continue;
    const series =
      (row.anilistId && byAl.get(row.anilistId)) ||
      (row.malId && byMal.get(row.malId)) ||
      kitsuMediaToSeries(row.media, kind);
    const a = row.entry.attributes as {
      status: string;
      progress?: number;
      ratingTwenty?: number | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      reconsumeCount?: number;
    };
    const entry: LibraryEntry = {
      seriesId: series.id,
      status: mapKitsuStatus(a.status),
      progress: a.progress ?? 0,
      rating: a.ratingTwenty ? a.ratingTwenty * 5 : undefined,
      startedAt: a.startedAt?.slice(0, 10) ?? undefined,
      finishedAt: a.finishedAt?.slice(0, 10) ?? undefined,
      repeats: a.reconsumeCount ?? 0,
      favorite: false,
      source: "kitsu",
      addedAt: now,
      updatedAt: now,
    };
    items.push({ series, entry });
  }
  return items;
}
