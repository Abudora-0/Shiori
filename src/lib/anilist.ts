import type {
  CharacterInfo,
  EntryStatus,
  LibraryEntry,
  MediaKind,
  RecommendedSeries,
  RelatedSeries,
  Series,
  SeriesExtra,
} from "./types";
import { stripHtml } from "./format";

const ENDPOINT = "https://graphql.anilist.co";

/**
 * All AniList calls are funneled through one queue with a minimum interval,
 * because the API allows only ~30 req/min and responds to bursts with
 * CORS-less 429s that surface in the browser as bare "Failed to fetch".
 */
const MIN_INTERVAL = 2100;
let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string
): Promise<T> {
  const run = chain.then(() => doGql<T>(query, variables, token));
  chain = run.catch(() => {});
  return run;
}

async function doGql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      // Network/CORS failure - almost always AniList rate-limiting without
      // CORS headers. Back off and retry.
      await sleep(15_000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "30") * 1000;
      await sleep(retryAfter + 500);
      continue;
    }
    const json = await res.json();
    if (!res.ok || json.errors) {
      const msg = json.errors?.[0]?.message ?? `AniList error (${res.status})`;
      throw new Error(msg);
    }
    return json.data as T;
  }
  throw new Error(
    "AniList is rate-limiting right now - wait a minute and try again (progress you already imported is saved)."
  );
}

/* ----- Shared media fragment & mapping ----- */

export const MEDIA_FIELDS = `
  id
  idMal
  type
  format
  status
  isAdult
  countryOfOrigin
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  genres
  tags { name rank }
  episodes
  chapters
  volumes
  averageScore
  popularity
  season
  seasonYear
  startDate { year }
  studios(isMain: true) { nodes { name } }
  staff(perPage: 4, sort: RELEVANCE) { edges { role node { name { full } } } }
`;

export interface RawMedia {
  id: number;
  idMal?: number;
  type: "ANIME" | "MANGA";
  format?: string;
  status?: string;
  isAdult?: boolean;
  countryOfOrigin?: string;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { extraLarge?: string; large?: string; color?: string };
  bannerImage?: string;
  description?: string;
  genres?: string[];
  tags?: { name: string; rank?: number }[];
  episodes?: number;
  chapters?: number;
  volumes?: number;
  averageScore?: number;
  popularity?: number;
  season?: string;
  seasonYear?: number;
  startDate?: { year?: number };
  studios?: { nodes: { name: string }[] };
  staff?: { edges: { role: string; node: { name: { full: string } } }[] };
}

export function classifyKind(media: {
  type: "ANIME" | "MANGA";
  format?: string;
  countryOfOrigin?: string;
  isAdult?: boolean;
}): MediaKind {
  if (media.type === "ANIME") return "ANIME";
  if (media.countryOfOrigin === "KR") return media.isAdult ? "PORNHWA" : "MANHWA";
  if (media.countryOfOrigin === "CN" || media.countryOfOrigin === "TW")
    return "MANHUA";
  return "MANGA";
}

export function mapMediaToSeries(m: RawMedia): Series {
  const authorRoles = /story|art|author|original creator/i;
  return {
    id: m.id,
    idMal: m.idMal ?? undefined,
    kind: classifyKind(m),
    title: m.title,
    cover: m.coverImage?.extraLarge || m.coverImage?.large,
    coverColor: m.coverImage?.color ?? undefined,
    banner: m.bannerImage ?? undefined,
    synopsis: stripHtml(m.description),
    genres: m.genres ?? [],
    tags: (m.tags ?? []).slice(0, 12),
    format: m.format,
    mediaStatus: m.status,
    episodes: m.episodes ?? undefined,
    chapters: m.chapters ?? undefined,
    volumes: m.volumes ?? undefined,
    meanScore: m.averageScore ?? undefined,
    popularity: m.popularity ?? undefined,
    year: m.seasonYear ?? m.startDate?.year ?? undefined,
    season: m.season ?? undefined,
    studios: m.studios?.nodes.map((s) => s.name) ?? [],
    authors:
      m.staff?.edges
        .filter((e) => authorRoles.test(e.role))
        .map((e) => e.node.name.full) ?? [],
    countryOfOrigin: m.countryOfOrigin,
    cachedAt: Date.now(),
  };
}

/* ----- User list import ----- */

const LIST_QUERY = `
query ($userName: String, $type: MediaType) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      entries {
        status
        progress
        progressVolumes
        score(format: POINT_100)
        repeat
        startedAt { year month day }
        completedAt { year month day }
        media { ${MEDIA_FIELDS} }
      }
    }
  }
}`;

interface RawListEntry {
  status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
  progress: number;
  progressVolumes?: number;
  score: number;
  repeat: number;
  startedAt?: { year?: number; month?: number; day?: number };
  completedAt?: { year?: number; month?: number; day?: number };
  media: RawMedia;
}

function fuzzyDateToIso(d?: { year?: number; month?: number; day?: number }) {
  if (!d?.year) return undefined;
  const mm = String(d.month ?? 1).padStart(2, "0");
  const dd = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

function mapStatus(s: RawListEntry["status"]): EntryStatus {
  switch (s) {
    case "CURRENT":
    case "REPEATING":
      return "current";
    case "PLANNING":
      return "planning";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
    case "PAUSED":
      return "paused";
  }
}

export interface ImportedItem {
  series: Series;
  entry: LibraryEntry;
}

export async function fetchAniListUserList(
  userName: string,
  type: "ANIME" | "MANGA"
): Promise<ImportedItem[]> {
  const data = await gql<{
    MediaListCollection: { lists: { entries: RawListEntry[] }[] } | null;
  }>(LIST_QUERY, { userName, type });

  const lists = data.MediaListCollection?.lists ?? [];
  const now = Date.now();
  const seen = new Set<number>();
  const items: ImportedItem[] = [];

  for (const list of lists) {
    for (const e of list.entries) {
      if (seen.has(e.media.id)) continue;
      seen.add(e.media.id);
      items.push({
        series: mapMediaToSeries(e.media),
        entry: {
          seriesId: e.media.id,
          status: mapStatus(e.status),
          progress: e.progress ?? 0,
          progressVolumes: e.progressVolumes ?? undefined,
          rating: e.score > 0 ? e.score : undefined,
          startedAt: fuzzyDateToIso(e.startedAt),
          finishedAt: fuzzyDateToIso(e.completedAt),
          repeats: e.repeat ?? 0,
          favorite: false,
          source: "anilist",
          addedAt: now,
          updatedAt: now,
        },
      });
    }
  }
  return items;
}

/* ----- Per-series detail (characters / relations / recommendations) ----- */

const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    characters(sort: [ROLE, RELEVANCE], perPage: 16) {
      edges {
        role
        node { id name { full native } image { large } }
        voiceActors(language: JAPANESE, sort: RELEVANCE) {
          name { full }
          image { large }
        }
      }
    }
    relations {
      edges {
        relationType(version: 2)
        node {
          id type format countryOfOrigin isAdult
          title { romaji english native }
          coverImage { large color }
        }
      }
    }
    recommendations(perPage: 14, sort: RATING_DESC) {
      nodes {
        rating
        mediaRecommendation {
          id type format countryOfOrigin isAdult
          title { romaji english native }
          coverImage { large color }
          averageScore
          genres
        }
      }
    }
  }
}`;

interface RawDetail {
  Media: {
    id: number;
    characters: {
      edges: {
        role: string;
        node: {
          id: number;
          name: { full: string; native?: string };
          image?: { large?: string };
        };
        voiceActors: { name: { full: string }; image?: { large?: string } }[];
      }[];
    };
    relations: {
      edges: {
        relationType: string;
        node: {
          id: number;
          type: "ANIME" | "MANGA";
          format?: string;
          countryOfOrigin?: string;
          title: { romaji?: string; english?: string; native?: string };
          coverImage?: { large?: string; color?: string };
        };
      }[];
    };
    recommendations: {
      nodes: {
        rating: number;
        mediaRecommendation: {
          id: number;
          type: "ANIME" | "MANGA";
          format?: string;
          countryOfOrigin?: string;
          title: { romaji?: string; english?: string; native?: string };
          coverImage?: { large?: string; color?: string };
          averageScore?: number;
          genres?: string[];
        } | null;
      }[];
    };
  };
}

export async function fetchSeriesExtra(id: number): Promise<SeriesExtra> {
  const data = await gql<RawDetail>(DETAIL_QUERY, { id });
  const m = data.Media;

  const characters: CharacterInfo[] = m.characters.edges.map((e) => ({
    id: e.node.id,
    name: e.node.name.full,
    nativeName: e.node.name.native,
    image: e.node.image?.large,
    role: e.role,
    voiceActor: e.voiceActors[0]
      ? { name: e.voiceActors[0].name.full, image: e.voiceActors[0].image?.large }
      : undefined,
  }));

  const relations: RelatedSeries[] = m.relations.edges
    .filter((e) => e.node.type === "ANIME" || e.node.type === "MANGA")
    .map((e) => ({
      id: e.node.id,
      relationType: e.relationType.replace(/_/g, " "),
      kind: classifyKind(e.node),
      format: e.node.format,
      title: e.node.title,
      cover: e.node.coverImage?.large,
      coverColor: e.node.coverImage?.color ?? undefined,
    }));

  const recommendations: RecommendedSeries[] = m.recommendations.nodes
    .filter((n) => n.mediaRecommendation)
    .map((n) => {
      const r = n.mediaRecommendation!;
      return {
        id: r.id,
        kind: classifyKind(r),
        format: r.format,
        title: r.title,
        cover: r.coverImage?.large,
        coverColor: r.coverImage?.color ?? undefined,
        meanScore: r.averageScore ?? undefined,
        genres: r.genres ?? [],
        votes: n.rating,
      };
    });

  return { seriesId: m.id, characters, relations, recommendations, cachedAt: Date.now() };
}

/* ----- Search ----- */

export async function searchAniList(
  search: string,
  type?: "ANIME" | "MANGA"
): Promise<Series[]> {
  const query = `
    query ($search: String, $type: MediaType) {
      Page(perPage: 20) {
        media(search: $search, type: $type, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`;
  const data = await gql<{ Page: { media: RawMedia[] } }>(query, {
    search,
    type: type ?? undefined,
  });
  return data.Page.media.map(mapMediaToSeries);
}

/** Fetch a single series by AniList id (for adding from search/similar). */
export async function fetchSeriesById(id: number): Promise<Series> {
  const query = `query ($id: Int) { Media(id: $id) { ${MEDIA_FIELDS} } }`;
  const data = await gql<{ Media: RawMedia }>(query, { id });
  return mapMediaToSeries(data.Media);
}

/** Resolve AniList ids → media in batches of 50 (Kitsu/Mihon importers). */
export async function resolveByAniListIds(ids: number[]): Promise<Map<number, Series>> {
  const query = `
    query ($ids: [Int], $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(id_in: $ids) { ${MEDIA_FIELDS} }
      }
    }`;
  const out = new Map<number, Series>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    let page = 1;
    for (;;) {
      const data = await gql<{
        Page: { pageInfo: { hasNextPage: boolean }; media: RawMedia[] };
      }>(query, { ids: chunk, page });
      for (const m of data.Page.media) out.set(m.id, mapMediaToSeries(m));
      if (!data.Page.pageInfo.hasNextPage) break;
      page++;
    }
  }
  return out;
}

/** Resolve MAL ids → AniList media in batches of 50 (for the MAL importer). */
export async function resolveByMalIds(
  idMals: number[],
  type: "ANIME" | "MANGA"
): Promise<Map<number, Series>> {
  const query = `
    query ($idMals: [Int], $type: MediaType, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(idMal_in: $idMals, type: $type) { ${MEDIA_FIELDS} }
      }
    }`;
  const out = new Map<number, Series>();
  for (let i = 0; i < idMals.length; i += 50) {
    const chunk = idMals.slice(i, i + 50);
    let page = 1;
    for (;;) {
      const data = await gql<{
        Page: { pageInfo: { hasNextPage: boolean }; media: RawMedia[] };
      }>(query, { idMals: chunk, type, page });
      for (const m of data.Page.media) {
        if (m.idMal) out.set(m.idMal, mapMediaToSeries(m));
      }
      if (!data.Page.pageInfo.hasNextPage) break;
      page++;
    }
  }
  return out;
}
