import pako from "pako";
import { parseMihonBackup } from "./importers/mihon";
import { fetchNhentaiGallery, upsertDoujin } from "./doujin";
import { detect } from "./doujin-detect";
import { db, getSetting } from "./db";
import type { DoujinEntry, DoujinSource } from "./types";

/**
 * Pull doujins out of a Tachiyomi-family backup (Mihon .tachibk / .proto.gz,
 * or TachiyomiAZ-era legacy .json), keep only nhentai / HentaiFox / Hitomi
 * entries, and enrich each one with fresh metadata from its site. Regular
 * manga in the backup are ignored here - the main Import page handles those.
 */

interface DoujinCandidate {
  source: DoujinSource;
  id: string;
  title?: string;
  thumb?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract candidates from either backup format. */
export function extractDoujinCandidates(buffer: ArrayBuffer): {
  candidates: DoujinCandidate[];
  totalManga: number;
} {
  let bytes = new Uint8Array(buffer);
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = pako.ungzip(bytes);
  }

  // Legacy JSON (TachiyomiAZ and other pre-protobuf forks)
  const firstChar = String.fromCharCode(bytes[0]);
  if (firstChar === "{") {
    return extractFromLegacyJson(new TextDecoder().decode(bytes));
  }

  // Modern protobuf
  const { mangas, sources } = parseMihonBackup(bytes);
  const favorites = mangas.filter((m) => m.favorite !== false && (m.title || m.url));
  const candidates: DoujinCandidate[] = [];
  for (const m of favorites) {
    const hit = detect(m.url, m.source ? sources.get(m.source) : undefined);
    if (hit) {
      candidates.push({ ...hit, title: m.title, thumb: m.thumbnailUrl });
    }
  }
  return { candidates, totalManga: favorites.length };
}

function extractFromLegacyJson(text: string): {
  candidates: DoujinCandidate[];
  totalManga: number;
} {
  const json = JSON.parse(text) as {
    version?: number;
    mangas?: { manga?: unknown[] }[];
    extensions?: string[];
  };
  if (!Array.isArray(json.mangas)) {
    throw new Error("Unrecognized backup JSON - expected a Tachiyomi legacy backup.");
  }

  // extensions: ["<sourceId>:<name>", ...] - ids can exceed 2^53, keep as string
  const sourceNames = new Map<string, string>();
  for (const ext of json.extensions ?? []) {
    const idx = ext.indexOf(":");
    if (idx > 0) sourceNames.set(ext.slice(0, idx), ext.slice(idx + 1));
  }

  // NOTE: unlike the modern .tachibk path (which skips entries with
  // favorite === false, i.e. history-only manga you never actually
  // favorited), this legacy path does NOT filter by a favorite flag. The
  // old Tachiyomi JSON format's positional MANGA array is not something we
  // have a verified field-by-field spec for, and guessing the wrong index
  // for "favorite" risks silently dropping doujins the user genuinely
  // favorited - a much worse failure than importing a few extra entries
  // someone can just delete from the Annex. If you hit this with a real
  // legacy backup and can confirm the flag's position, tighten this filter.
  const candidates: DoujinCandidate[] = [];
  let total = 0;
  for (const wrapper of json.mangas) {
    const arr = wrapper.manga;
    if (!Array.isArray(arr)) continue;
    total++;
    // Legacy MANGA array: [url, title, source, viewer, flags]
    const url = typeof arr[0] === "string" ? arr[0] : undefined;
    const title = typeof arr[1] === "string" ? arr[1] : undefined;
    const sourceId =
      typeof arr[2] === "number" || typeof arr[2] === "string" ? String(arr[2]) : "";
    const hit = detect(url, sourceNames.get(sourceId));
    if (hit) candidates.push({ ...hit, title });
  }
  return { candidates, totalManga: total };
}

export interface DoujinBackupProgress {
  phase: "scanning" | "fetching";
  count: number;
  total?: number;
  current?: string;
}

export interface DoujinBackupResult {
  found: number;
  added: number;
  updated: number;
  fallback: number;
  failed: number;
  skipped: number;
  scanned: number;
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once -
 * a simple pull-based pool (each slot grabs the next index when it finishes)
 * rather than chunking, so one slow item can't stall the others.
 */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  async function slot() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, slot)
  );
}

// Per-site concurrency for metadata fetches. Tried 3, then 5 unconditionally
// once: both got the (server-side) proxy Cloudflare-blocked almost
// immediately on a real large nhentai-heavy backup - every request past the
// first few silently degrades to the no-metadata fallback instead of
// erroring loudly, which is far worse than slow. 1 (serial) is the only
// value verified not to trigger that - anything higher is a real, visible
// tradeoff the user opts into via the Annex import UI, not a safe default.
export const DEFAULT_BACKUP_CONCURRENCY = 1;
/** UI-enforced ceiling - keeps a fat-fingered value from hammering a source. */
export const MAX_BACKUP_CONCURRENCY = 6;

export interface DoujinBackupOptions {
  /** Per-source concurrent metadata fetches. Higher = faster but more likely
   * to get Cloudflare-blocked, degrading entries to backup-only fallback data. */
  concurrency?: number;
}

export async function importDoujinsFromBackup(
  buffer: ArrayBuffer,
  options?: DoujinBackupOptions,
  onProgress?: (p: DoujinBackupProgress) => void
): Promise<DoujinBackupResult> {
  const concurrency = Math.max(
    1,
    Math.min(options?.concurrency ?? DEFAULT_BACKUP_CONCURRENCY, MAX_BACKUP_CONCURRENCY)
  );
  const { candidates, totalManga } = extractDoujinCandidates(buffer);
  onProgress?.({ phase: "scanning", count: candidates.length, total: totalManga });
  if (candidates.length === 0) {
    throw new Error(
      `Scanned ${totalManga} entries but found none from nhentai / HentaiFox / Hitomi.`
    );
  }

  const nhCookie = await getSetting<string>("nhCookie");
  // Already-imported entries are skipped outright (no re-fetch) so retrying
  // a huge backup after an interruption only does work for what's missing -
  // but only entries with real fetched metadata count as "done". A fallback
  // save (empty tags/artists, site refused at the time) must stay eligible,
  // or a degraded entry from a bad run can never be upgraded by a later one.
  const existing = new Set(
    (await db.doujins.toArray())
      .filter((d) => d.tags.length > 0 || d.artists.length > 0)
      .map((d) => `${d.source}:${d.sourceId}`)
  );
  const result: DoujinBackupResult = {
    found: candidates.length,
    added: 0,
    updated: 0,
    fallback: 0,
    failed: 0,
    skipped: 0,
    scanned: totalManga,
  };

  const bySource = new Map<DoujinSource, DoujinCandidate[]>();
  for (const c of candidates) {
    const group = bySource.get(c.source);
    if (group) group.push(c);
    else bySource.set(c.source, [c]);
  }

  let processed = 0;
  async function handleOne(c: DoujinCandidate) {
    processed++;
    onProgress?.({
      phase: "fetching",
      count: processed,
      total: candidates.length,
      current: c.title ?? `${c.source} #${c.id}`,
    });
    if (existing.has(`${c.source}:${c.id}`)) {
      result.skipped++;
      return;
    }

    async function fetchMeta(): Promise<Omit<DoujinEntry, "id" | "addedAt" | "favorite">> {
      if (c.source === "nhentai") return fetchNhentaiGallery(c.id, nhCookie);
      const res = await fetch(`/api/proxy/${c.source}?id=${c.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "lookup failed");
      return {
        source: c.source,
        sourceId: c.id,
        title: json.title,
        titleNative: json.titleNative,
        url: json.url,
        cover: json.cover,
        tags: json.tags ?? [],
        artists: json.artists ?? [],
        groups: json.groups ?? [],
        parodies: json.parodies ?? [],
        characters: json.characters ?? [],
        language: json.language,
        pages: json.pages,
      };
    }

    try {
      // A single failure is often a transient block (Cloudflare, a momentary
      // rate limit) rather than a genuinely dead/missing gallery - give it a
      // couple of spaced-out retries before accepting the no-metadata
      // fallback below, which otherwise silently locks in permanently
      // degraded data for the entry.
      let meta: Omit<DoujinEntry, "id" | "addedAt" | "favorite"> | undefined;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await sleep(3000 * attempt);
        try {
          meta = await fetchMeta();
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!meta) throw lastErr;
      const outcome = await upsertDoujin(meta);
      result[outcome]++;
    } catch {
      // Site refused - keep what the backup itself knows
      if (c.title) {
        const urls: Record<DoujinSource, string> = {
          nhentai: `https://nhentai.net/g/${c.id}/`,
          hentaifox: `https://hentaifox.com/gallery/${c.id}/`,
          hentaiera: `https://hentaiera.com/gallery/${c.id}/`,
          hitomi: `https://hitomi.la/galleries/${c.id}.html`,
          manual: "",
        };
        await upsertDoujin({
          source: c.source,
          sourceId: c.id,
          title: c.title,
          url: urls[c.source],
          cover: c.thumb,
          tags: [],
          artists: [],
        });
        result.fallback++;
      } else {
        result.failed++;
      }
    }
    await sleep(400);
  }

  await Promise.all(
    [...bySource.values()].map((group) => runPool(group, concurrency, handleOne))
  );
  return result;
}
