import type { EntryStatus, LibraryEntry, Series } from "../types";
import type { ImportedItem } from "../anilist";
import { resolveByMalIds } from "../anilist";

/**
 * MyAnimeList importer.
 * Public lists are readable with just a Client ID (registered free at
 * myanimelist.net/apiconfig) - no OAuth. Requests go through our
 * /api/proxy/mal route to avoid CORS.
 */

const LIST_FIELDS =
  "list_status{status,score,num_episodes_watched,num_chapters_read,num_volumes_read,num_times_rewatched,start_date,finish_date},node(id,title,main_picture,media_type,status,num_episodes,num_chapters,num_volumes,mean,start_date,genres,alternative_titles)";

interface MalNode {
  id: number;
  title: string;
  main_picture?: { large?: string; medium?: string };
  media_type?: string;
  status?: string;
  num_episodes?: number;
  num_chapters?: number;
  num_volumes?: number;
  mean?: number;
  start_date?: string;
  genres?: { name: string }[];
  alternative_titles?: { en?: string; ja?: string };
}

interface MalListStatus {
  status: string;
  score: number;
  num_episodes_watched?: number;
  num_chapters_read?: number;
  num_volumes_read?: number;
  num_times_rewatched?: number;
  start_date?: string;
  finish_date?: string;
}

interface MalListItem {
  node: MalNode;
  list_status: MalListStatus;
}

function mapMalStatus(s: string): EntryStatus {
  switch (s) {
    case "watching":
    case "reading":
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

async function fetchMalList(
  username: string,
  clientId: string,
  kind: "animelist" | "mangalist",
  onProgress?: (fetched: number) => void
): Promise<MalListItem[]> {
  const items: MalListItem[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      fields: LIST_FIELDS,
      limit: "100",
      offset: String(offset),
      nsfw: "true",
    });
    const res = await fetch(
      `/api/proxy/mal/users/${encodeURIComponent(username)}/${kind}?${params}`,
      { headers: { "x-mal-client-id": clientId } }
    );
    if (res.status === 404) throw new Error(`MAL user "${username}" not found.`);
    if (res.status === 401 || res.status === 403)
      throw new Error("MAL rejected the Client ID - check it in Settings.");
    if (!res.ok) throw new Error(`MAL error (${res.status}).`);
    const json = await res.json();
    items.push(...(json.data ?? []));
    onProgress?.(items.length);
    if (!json.paging?.next) break;
    offset += 100;
  }
  return items;
}

/**
 * Fallback Series when a MAL entry has no AniList match. Negative id namespace;
 * MAL anime and manga ids overlap, so manga gets an extra offset.
 */
function malNodeToSeries(node: MalNode, type: "ANIME" | "MANGA"): Series {
  const isKr = node.media_type === "manhwa";
  const isCn = node.media_type === "manhua";
  return {
    id: type === "ANIME" ? -node.id : -(node.id + 1_000_000_000),
    idMal: node.id,
    kind:
      type === "ANIME" ? "ANIME" : isKr ? "MANHWA" : isCn ? "MANHUA" : "MANGA",
    title: {
      romaji: node.title,
      english: node.alternative_titles?.en || undefined,
      native: node.alternative_titles?.ja || undefined,
    },
    cover: node.main_picture?.large || node.main_picture?.medium,
    genres: node.genres?.map((g) => g.name) ?? [],
    tags: [],
    format: node.media_type?.toUpperCase(),
    mediaStatus: node.status?.toUpperCase(),
    episodes: node.num_episodes || undefined,
    chapters: node.num_chapters || undefined,
    volumes: node.num_volumes || undefined,
    meanScore: node.mean ? Math.round(node.mean * 10) : undefined,
    year: node.start_date ? Number(node.start_date.slice(0, 4)) : undefined,
    countryOfOrigin: isKr ? "KR" : isCn ? "CN" : "JP",
    cachedAt: Date.now(),
  };
}

export interface MalImportProgress {
  phase: "fetching" | "resolving";
  count: number;
  total?: number;
}

export async function fetchMalUserList(
  username: string,
  clientId: string,
  type: "ANIME" | "MANGA",
  onProgress?: (p: MalImportProgress) => void
): Promise<ImportedItem[]> {
  const kind = type === "ANIME" ? "animelist" : "mangalist";
  const raw = await fetchMalList(username, clientId, kind, (n) =>
    onProgress?.({ phase: "fetching", count: n })
  );

  onProgress?.({ phase: "resolving", count: 0, total: raw.length });
  const resolved = await resolveByMalIds(
    raw.map((r) => r.node.id),
    type
  );
  onProgress?.({ phase: "resolving", count: raw.length, total: raw.length });

  const now = Date.now();
  return raw.map((item) => {
    const series = resolved.get(item.node.id) ?? malNodeToSeries(item.node, type);
    const ls = item.list_status;
    const entry: LibraryEntry = {
      seriesId: series.id,
      status: mapMalStatus(ls.status),
      progress:
        type === "ANIME" ? (ls.num_episodes_watched ?? 0) : (ls.num_chapters_read ?? 0),
      progressVolumes: ls.num_volumes_read || undefined,
      rating: ls.score > 0 ? ls.score * 10 : undefined,
      startedAt: ls.start_date,
      finishedAt: ls.finish_date,
      repeats: ls.num_times_rewatched ?? 0,
      favorite: false,
      source: "mal",
      addedAt: now,
      updatedAt: now,
    };
    return { series, entry };
  });
}
