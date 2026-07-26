import { db, getSetting, setSetting } from "./db";
import { gql } from "./anilist";
import type { EntryStatus, LibraryEntry, Series } from "./types";

/**
 * Push-only sync back to AniList via OAuth (Authorization Code Grant).
 * Shiori is otherwise a one-way importer; this closes the loop for anyone
 * who wants their AniList list to reflect edits made in Shiori. Manual and
 * opt-in only - nothing here runs automatically, since silently overwriting
 * a user's AniList data without an explicit action would be far worse than
 * a missed sync.
 */

const CLIENT_ID_KEY = "anilistClientId";
const CLIENT_SECRET_KEY = "anilistClientSecret";
const TOKEN_KEY = "anilistAccessToken";
const USERNAME_KEY = "anilistUsername_oauth";

export interface AniListConnection {
  connected: boolean;
  username?: string;
  clientId?: string;
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `https://anilist.co/api/v2/oauth/authorize?${params}`;
}

export async function saveClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<void> {
  await setSetting(CLIENT_ID_KEY, clientId);
  await setSetting(CLIENT_SECRET_KEY, clientSecret);
}

export async function getClientCredentials(): Promise<{
  clientId?: string;
  clientSecret?: string;
}> {
  return {
    clientId: await getSetting<string>(CLIENT_ID_KEY),
    clientSecret: await getSetting<string>(CLIENT_SECRET_KEY),
  };
}

/** Exchanges an authorization code for an access token and confirms it works. */
export async function completeAuthorization(
  code: string,
  redirectUri: string
): Promise<string> {
  const { clientId, clientSecret } = await getClientCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Missing AniList Client ID/Secret - save them first.");
  }
  const res = await fetch("/api/proxy/anilist-oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, clientId, clientSecret, redirectUri }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "AniList authorization failed.");
  const token = json.access_token as string;
  if (!token) throw new Error("AniList didn't return an access token.");

  const viewer = await fetchViewerName(token);
  await setSetting(TOKEN_KEY, token);
  await setSetting(USERNAME_KEY, viewer);
  return viewer;
}

async function fetchViewerName(token: string): Promise<string> {
  const data = await gql<{ Viewer: { name: string } }>(
    `query { Viewer { name } }`,
    {},
    token
  );
  return data.Viewer.name;
}

export async function getConnection(): Promise<AniListConnection> {
  const [token, username, clientId] = await Promise.all([
    getSetting<string>(TOKEN_KEY),
    getSetting<string>(USERNAME_KEY),
    getSetting<string>(CLIENT_ID_KEY),
  ]);
  return { connected: !!token, username, clientId };
}

export async function disconnect(): Promise<void> {
  await db.settings.bulkDelete([TOKEN_KEY, USERNAME_KEY]);
}

async function getToken(): Promise<string> {
  const token = await getSetting<string>(TOKEN_KEY);
  if (!token) throw new Error("Not connected to AniList - connect in Settings first.");
  return token;
}

/* ----- Push mutation ----- */

const STATUS_TO_ANILIST: Record<EntryStatus, string> = {
  current: "CURRENT",
  planning: "PLANNING",
  completed: "COMPLETED",
  dropped: "DROPPED",
  paused: "PAUSED",
};

function dateToFuzzy(iso?: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return null;
  return { year: y, month: m || 1, day: d || 1 };
}

const SAVE_MUTATION = `
mutation (
  $mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int,
  $score: Float, $repeat: Int, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput
) {
  SaveMediaListEntry(
    mediaId: $mediaId, status: $status, progress: $progress,
    progressVolumes: $progressVolumes, scoreRaw: $score, repeat: $repeat,
    startedAt: $startedAt, completedAt: $completedAt
  ) { id }
}`;

/** Push one local entry's state up to AniList. `series.id` must be a real AniList id. */
export async function pushEntryToAniList(
  series: Series,
  entry: LibraryEntry
): Promise<void> {
  if (series.id <= 0) {
    throw new Error("This series isn't linked to AniList - use Link to AniList first.");
  }
  const token = await getToken();
  await gql(
    SAVE_MUTATION,
    {
      mediaId: series.id,
      status: STATUS_TO_ANILIST[entry.status],
      progress: entry.progress,
      progressVolumes: entry.progressVolumes ?? null,
      score: entry.rating ?? 0,
      repeat: entry.repeats,
      startedAt: dateToFuzzy(entry.startedAt),
      completedAt: dateToFuzzy(entry.finishedAt),
    },
    token
  );
}

export interface SyncProgress {
  count: number;
  total: number;
  current: string;
}

export interface SyncResult {
  pushed: number;
  failed: number;
}

/** Push every AniList-linked library entry. Rate-limited by the shared gql queue. */
export async function syncAllToAniList(
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  await getToken(); // fail fast if not connected
  const entries = await db.entries.toArray();
  const linked = entries.filter((e) => e.seriesId > 0);
  const series = await db.series.bulkGet(linked.map((e) => e.seriesId));

  const result: SyncResult = { pushed: 0, failed: 0 };
  for (let i = 0; i < linked.length; i++) {
    const s = series[i];
    if (!s) continue;
    onProgress?.({
      count: i + 1,
      total: linked.length,
      current: s.title.english ?? s.title.romaji ?? `#${s.id}`,
    });
    try {
      await pushEntryToAniList(s, linked[i]);
      result.pushed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
