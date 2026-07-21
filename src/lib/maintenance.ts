import { db } from "./db";
import { resolveByAniListIds } from "./anilist";
import { displayTitle } from "./format";
import { HARD_ADULT_SOURCES } from "./importers/mihon";
import type { MediaKind, Series } from "./types";

/**
 * Library maintenance jobs, run from Settings:
 * - fixMissingCovers: title-searches MangaDex → Comick → Anime-Planet for
 *   series without a working cover (mostly Mihon local entries).
 * - reclassifyLibrary: re-resolves AniList-known series (picking up isAdult →
 *   PORNHWA) and applies adult-genre heuristics to local entries.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  // Scanlation renames: accept ≥70% word overlap in either direction
  const ta = na.split(" ");
  const tb = new Set(nb.split(" "));
  if (ta.length < 2 || tb.size < 2) return false;
  const hits = ta.filter((t) => tb.has(t)).length;
  return hits / ta.length >= 0.7 || hits / tb.size >= 0.7;
}

/** Search variants for stubborn titles: strip brackets/noise, cut at colon. */
function titleVariants(s: Series): string[] {
  const main = displayTitle(s.title);
  const cleaned = main
    .replace(/[\[(][^\])]*[\])]/g, " ")
    .replace(/\b(official|uncensored|raw|webtoon|manhwa|mature|18\+?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const preColon = main.split(/[:：\-–—]/)[0].trim();
  const out = [main, s.title.english, s.title.romaji, cleaned, preColon]
    .filter((t): t is string => !!t && t.length >= 4)
    .map((t) => t.trim());
  return [...new Set(out)].slice(0, 3);
}

// Deliberately strict: "Mature"/"Gore" are common on ordinary action manhwa
// and must NOT count as porn.
const ADULT_GENRES = /\b(adult|smut|hentai|erotica|pornhwa)\b|18\+/i;
const KOREAN_GENRES = /manhwa|webtoon|korean/i;

export function looksAdult(genres: string[]): boolean {
  return genres.some((g) => ADULT_GENRES.test(g));
}

export function looksKorean(genres: string[]): boolean {
  return genres.some((g) => KOREAN_GENRES.test(g));
}

/* ————— Cover repair ————— */

const NET_TIMEOUT = 10_000;

async function coverFromMangaDex(title: string): Promise<string | undefined> {
  const res = await fetch(
    `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5` +
      `&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
    { signal: AbortSignal.timeout(NET_TIMEOUT) }
  );
  if (!res.ok) return undefined;
  const json = (await res.json()) as {
    data: {
      id: string;
      attributes: {
        title: Record<string, string>;
        altTitles: Record<string, string>[];
      };
      relationships: { type: string; attributes?: { fileName?: string } }[];
    }[];
  };
  for (const m of json.data ?? []) {
    const names = [
      ...Object.values(m.attributes.title ?? {}),
      ...(m.attributes.altTitles ?? []).flatMap((t) => Object.values(t)),
    ];
    if (!names.some((n) => titlesMatch(n, title))) continue;
    const file = m.relationships.find((r) => r.type === "cover_art")?.attributes
      ?.fileName;
    if (file) return `https://uploads.mangadex.org/covers/${m.id}/${file}.256.jpg`;
  }
  return undefined;
}

async function coverFromComick(title: string): Promise<string | undefined> {
  const res = await fetch(
    `/api/proxy/comick/v1.0/search?q=${encodeURIComponent(title)}&limit=5&type=comic`,
    { signal: AbortSignal.timeout(NET_TIMEOUT) }
  );
  if (!res.ok) return undefined;
  const hits = (await res.json()) as {
    title?: string;
    md_covers?: { b2key?: string }[];
  }[];
  if (!Array.isArray(hits)) return undefined;
  for (const hit of hits) {
    if (!hit.title || !titlesMatch(hit.title, title)) continue;
    const key = hit.md_covers?.[0]?.b2key;
    if (key) return `https://meo.comick.pictures/${key}`;
  }
  return undefined;
}

async function coverFromAnimePlanet(
  title: string,
  kind: MediaKind
): Promise<string | undefined> {
  const type = kind === "ANIME" ? "anime" : "manga";
  const res = await fetch(
    `/api/proxy/animeplanet?title=${encodeURIComponent(title)}&type=${type}`,
    { signal: AbortSignal.timeout(NET_TIMEOUT) }
  );
  if (!res.ok) return undefined;
  const json = (await res.json()) as { name?: string; cover?: string };
  if (json.cover && json.name && titlesMatch(json.name, title)) return json.cover;
  return undefined;
}

/**
 * Scanlation aggregators scraped through /api/proxy/covers.
 * Pornhwa-heavy sites are tried first for pornhwa series.
 */
const GENERAL_SITES = [
  "mangakatana",
  "weebcentral",
  "mangafire",
  "kaliscan",
  "kingofshojo",
  "mangak",
  "mangafox",
  "kagane",
];
const PORNHWA_SITES = ["manhwabuddy", "madaradex"];

function scrapeOrder(kind: MediaKind): string[] {
  return kind === "PORNHWA"
    ? [...PORNHWA_SITES, ...GENERAL_SITES]
    : [...GENERAL_SITES, ...PORNHWA_SITES];
}

async function coverFromScrapeSite(
  site: string,
  title: string
): Promise<string | undefined> {
  const res = await fetch(
    `/api/proxy/covers?site=${site}&title=${encodeURIComponent(title)}`,
    { signal: AbortSignal.timeout(NET_TIMEOUT + 5000) }
  );
  if (!res.ok) return undefined;
  const json = (await res.json()) as { cover?: string };
  return json.cover;
}

export interface CoverFixProgress {
  phase: "checking" | "searching";
  count: number;
  total: number;
  current: string;
  fixed: number;
}

export interface CoverFixResult {
  scanned: number;
  fixed: number;
  failed: number;
}

/** CDNs that reliably serve us — no need to probe those. */
const TRUSTED_COVER_HOSTS =
  /anilist\.co|myanimelist\.net|kitsu\.(?:io|app)|mangadex\.org|comick\.pictures|anime-planet\.com|mangakatana|weebcentral|mangafire|kagane/i;

/** Load the URL exactly like the UI does (no referrer) and see if it renders. */
function probeImage(url: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => {
      img.src = "";
      resolve(false);
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

export async function fixMissingCovers(
  onProgress?: (p: CoverFixProgress) => void
): Promise<CoverFixResult> {
  const all = await db.series.toArray();

  // Coverless series are targets immediately; untrusted cover URLs (Mihon
  // source thumbnails etc.) are probed in the browser — dead ones become
  // targets too, since that's exactly what the user sees as a blank card.
  const targets = all.filter((s) => !s.cover);
  const toProbe = all.filter((s) => s.cover && !TRUSTED_COVER_HOSTS.test(s.cover));
  for (let i = 0; i < toProbe.length; i += 8) {
    const batch = toProbe.slice(i, i + 8);
    const alive = await Promise.all(batch.map((s) => probeImage(s.cover!)));
    batch.forEach((s, j) => {
      if (!alive[j]) targets.push(s);
    });
    onProgress?.({
      phase: "checking",
      count: Math.min(i + 8, toProbe.length),
      total: toProbe.length,
      current: "",
      fixed: 0,
    });
  }

  const result: CoverFixResult = { scanned: targets.length, fixed: 0, failed: 0 };

  for (let i = 0; i < targets.length; i++) {
    const s = targets[i];
    const variants = titleVariants(s);
    onProgress?.({
      phase: "searching",
      count: i + 1,
      total: targets.length,
      current: variants[0],
      fixed: result.fixed,
    });
    // Multiple title variants only pay off against exact-match APIs
    // (MangaDex/Anime-Planet) — decoration in the title is exactly what
    // trips those up. The 10+ scrape-site fallback chain already does its
    // own fuzzy matching server-side, so retrying it per variant would
    // multiply an already-long chain by 3x for little extra benefit; it
    // gets just the best (first) variant.
    let cover: string | undefined;
    for (const title of variants) {
      if (cover) break;
      try {
        cover = await coverFromMangaDex(title);
      } catch {
        /* provider down */
      }
      if (!cover && s.kind !== "PORNHWA") {
        // Anime-Planet doesn't carry pornhwa — skip the wasted request
        try {
          cover = await coverFromAnimePlanet(title, s.kind);
        } catch {
          /* provider down */
        }
      }
    }
    if (!cover) {
      const title = variants[0];
      // Scanlation aggregators — often the only places carrying pornhwa covers
      for (const site of scrapeOrder(s.kind)) {
        if (cover) break;
        try {
          cover = await coverFromScrapeSite(site, title);
        } catch {
          /* provider down */
        }
      }
      // Comick last — region-blocked for some users without a VPN
      if (!cover) {
        try {
          cover = await coverFromComick(title);
        } catch {
          /* provider down */
        }
      }
    }
    if (cover) {
      await db.series.update(s.id, { cover });
      result.fixed++;
    } else {
      result.failed++;
    }
    await sleep(350);
  }
  return result;
}

/* ————— Type re-classification (Pornhwa) ————— */

export interface ReclassifyProgress {
  phase: "anilist" | "local";
  count: number;
  total: number;
}

export interface ReclassifyResult {
  checked: number;
  updated: number;
  pornhwa: number;
}

export async function reclassifyLibrary(
  onProgress?: (p: ReclassifyProgress) => void
): Promise<ReclassifyResult> {
  const all = await db.series.toArray();
  const result: ReclassifyResult = { checked: all.length, updated: 0, pornhwa: 0 };

  // AniList-known manga-side series: re-fetch to pick up isAdult (→ PORNHWA)
  // and any metadata that predates newer classification logic.
  const remote = all.filter((s) => s.id > 0 && s.kind !== "ANIME");
  onProgress?.({ phase: "anilist", count: 0, total: remote.length });
  const fresh = await resolveByAniListIds(remote.map((s) => s.id));
  onProgress?.({ phase: "anilist", count: remote.length, total: remote.length });

  const toPut: Series[] = [];
  for (const s of remote) {
    const f = fresh.get(s.id);
    if (!f) continue;
    if (f.kind !== s.kind) {
      result.updated++;
      if (f.kind === "PORNHWA") result.pornhwa++;
    }
    toPut.push(f);
  }

  // Local entries: genre heuristics only (no external source of truth).
  // Also self-corrects earlier over-eager classifications: local PORNHWA
  // without a genuinely adult tag reverts to MANHWA.
  const locals = all.filter((s) => s.id < 0);
  onProgress?.({ phase: "local", count: 0, total: locals.length });
  for (const s of locals) {
    const tagNames = s.tags.map((t) => t.name);
    // Adult when the genres say so, or the entry came from an adult-only source
    const hardSource = !!s.sourceName && HARD_ADULT_SOURCES.test(s.sourceName);
    const adult = hardSource || looksAdult([...s.genres, ...tagNames]);
    const korean =
      s.kind === "MANHWA" ||
      s.kind === "PORNHWA" ||
      s.countryOfOrigin === "KR" ||
      looksKorean([...s.genres, ...tagNames]);
    if (adult && korean && s.kind !== "PORNHWA") {
      toPut.push({ ...s, kind: "PORNHWA" });
      result.updated++;
      result.pornhwa++;
    } else if (!adult && s.kind === "PORNHWA") {
      // Over-eager earlier classification (e.g. mixed sites like Toonily,
      // Hiperdex, NewToki) — send it back to Manhwa
      toPut.push({ ...s, kind: "MANHWA" });
      result.updated++;
    }
  }
  onProgress?.({ phase: "local", count: locals.length, total: locals.length });

  await db.series.bulkPut(toPut);
  return result;
}
