import pako from "pako";
import { parseMihonBackup } from "./importers/mihon";
import { fetchNhentaiGallery, upsertDoujin } from "./doujin";
import { getSetting } from "./db";
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

export function detect(
  url: string | undefined,
  sourceName: string | undefined
): { source: DoujinSource; id: string } | null {
  const u = url ?? "";
  const name = (sourceName ?? "").toLowerCase();

  // Require the real site's domain or an explicit source name before trying
  // to pull an id out of the URL - a bare path shape like "/g/<id>/" is not
  // unique to nhentai and turns up constantly in ordinary manga site URLs,
  // so treating an unnamed source as a match (the previous behavior) misread
  // large swaths of a real Mihon library as doujins.
  const isNhentai = /nhentai\.net/.test(u) || name.includes("nhentai");
  const isHentaiEra = /hentaiera\.com/.test(u) || name.includes("hentaiera");
  const isHentaiFox = /hentaifox\.com/.test(u) || name.includes("hentaifox");
  const isHitomi = /hitomi\.la/.test(u) || name.includes("hitomi");

  if (isNhentai) {
    const m = /\/g\/(\d+)/.exec(u) ?? /(\d{3,})/.exec(u);
    if (m) return { source: "nhentai", id: m[1] };
  }
  if (isHentaiEra) {
    const m = /\/(?:gallery|g)\/(\d+)/.exec(u) ?? /(\d{3,})/.exec(u);
    if (m) return { source: "hentaiera", id: m[1] };
  }
  if (isHentaiFox) {
    const m = /\/(?:gallery|g)\/(\d+)/.exec(u) ?? /(\d{3,})/.exec(u);
    if (m) return { source: "hentaifox", id: m[1] };
  }
  if (isHitomi) {
    const m =
      /(?:galleries|manga|doujinshi|cg|gamecg|reader)\/(?:[^/]*-)?(\d+)(?:\.html)?/.exec(u) ??
      /(\d{3,})/.exec(u);
    if (m) return { source: "hitomi", id: m[1] };
  }
  return null;
}

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
  scanned: number;
}

export async function importDoujinsFromBackup(
  buffer: ArrayBuffer,
  onProgress?: (p: DoujinBackupProgress) => void
): Promise<DoujinBackupResult> {
  const { candidates, totalManga } = extractDoujinCandidates(buffer);
  onProgress?.({ phase: "scanning", count: candidates.length, total: totalManga });
  if (candidates.length === 0) {
    throw new Error(
      `Scanned ${totalManga} entries but found none from nhentai / HentaiFox / Hitomi.`
    );
  }

  const nhCookie = await getSetting<string>("nhCookie");
  const result: DoujinBackupResult = {
    found: candidates.length,
    added: 0,
    updated: 0,
    fallback: 0,
    failed: 0,
    scanned: totalManga,
  };

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    onProgress?.({
      phase: "fetching",
      count: i + 1,
      total: candidates.length,
      current: c.title ?? `${c.source} #${c.id}`,
    });
    try {
      let meta: Omit<DoujinEntry, "id" | "addedAt" | "favorite">;
      if (c.source === "nhentai") {
        meta = await fetchNhentaiGallery(c.id, nhCookie);
      } else {
        const res = await fetch(`/api/proxy/${c.source}?id=${c.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "lookup failed");
        meta = {
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
  return result;
}
