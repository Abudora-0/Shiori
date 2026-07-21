/**
 * Diagnostic ping for every scraper-based source Shiori depends on. These
 * sites have no official API and no uptime guarantee — when one changes its
 * markup, the corresponding scraper just quietly returns nothing. This
 * probes each site with a near-universally-carried title ("One Piece") so a
 * broken scraper shows up as a discrete red row instead of a silent gap in
 * someone's cover-fix results.
 */

export interface SourceHealth {
  name: string;
  kind: "cover" | "chapter";
  status: "ok" | "no-match" | "down";
  detail?: string;
  ms: number;
}

const TEST_TITLE = "One Piece";
const TIMEOUT = 15_000;

const COVER_SITES = [
  { site: "mangakatana", name: "MangaKatana" },
  { site: "weebcentral", name: "WeebCentral" },
  { site: "mangafire", name: "MangaFire" },
  { site: "kaliscan", name: "KaliScan" },
  { site: "kingofshojo", name: "KingofShojo" },
  { site: "mangak", name: "MangaK" },
  { site: "mangafox", name: "MangaFox" },
  { site: "madaradex", name: "MadaraDex" },
  { site: "manhwabuddy", name: "ManhwaBuddy" },
  { site: "kagane", name: "Kagane" },
];

const CHAPTER_SITES = [
  { site: "mangakatana", name: "MangaKatana" },
  { site: "kaliscan", name: "KaliScan" },
  { site: "weebcentral", name: "WeebCentral" },
  { site: "kagane", name: "Kagane" },
];

async function testCoverSite(site: string, name: string): Promise<SourceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(
      `/api/proxy/covers?site=${site}&title=${encodeURIComponent(TEST_TITLE)}`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const ms = Date.now() - start;
    if (res.status === 404) return { name, kind: "cover", status: "no-match", ms };
    if (!res.ok)
      return { name, kind: "cover", status: "down", detail: `HTTP ${res.status}`, ms };
    const json = await res.json();
    return { name, kind: "cover", status: json.cover ? "ok" : "no-match", ms };
  } catch {
    return { name, kind: "cover", status: "down", detail: "timeout", ms: Date.now() - start };
  }
}

async function testChapterSite(site: string, name: string): Promise<SourceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(
      `/api/proxy/chapters?site=${site}&title=${encodeURIComponent(TEST_TITLE)}`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const ms = Date.now() - start;
    if (res.status === 404) return { name, kind: "chapter", status: "no-match", ms };
    if (!res.ok)
      return { name, kind: "chapter", status: "down", detail: `HTTP ${res.status}`, ms };
    const json = await res.json();
    return {
      name,
      kind: "chapter",
      status: json.chapters?.length ? "ok" : "no-match",
      ms,
    };
  } catch {
    return { name, kind: "chapter", status: "down", detail: "timeout", ms: Date.now() - start };
  }
}

async function testMangaDex(): Promise<SourceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(TEST_TITLE)}&limit=1`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const ms = Date.now() - start;
    if (!res.ok)
      return { name: "MangaDex", kind: "cover", status: "down", detail: `HTTP ${res.status}`, ms };
    const json = await res.json();
    return { name: "MangaDex", kind: "cover", status: json.data?.length ? "ok" : "no-match", ms };
  } catch {
    return { name: "MangaDex", kind: "cover", status: "down", detail: "timeout", ms: Date.now() - start };
  }
}

async function testAnimePlanet(): Promise<SourceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(
      `/api/proxy/animeplanet?title=${encodeURIComponent(TEST_TITLE)}&type=manga`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const ms = Date.now() - start;
    if (!res.ok)
      return { name: "Anime-Planet", kind: "cover", status: res.status === 404 ? "no-match" : "down", ms };
    const json = await res.json();
    return { name: "Anime-Planet", kind: "cover", status: json.cover ? "ok" : "no-match", ms };
  } catch {
    return { name: "Anime-Planet", kind: "cover", status: "down", detail: "timeout", ms: Date.now() - start };
  }
}

async function testComick(): Promise<SourceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(
      `/api/proxy/comick/v1.0/search?q=${encodeURIComponent(TEST_TITLE)}&limit=1&type=comic`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const ms = Date.now() - start;
    if (!res.ok)
      return { name: "Comick", kind: "cover", status: "down", detail: `HTTP ${res.status}`, ms };
    const json = await res.json();
    return {
      name: "Comick",
      kind: "cover",
      status: Array.isArray(json) && json.length > 0 ? "ok" : "no-match",
      ms,
    };
  } catch {
    return { name: "Comick", kind: "cover", status: "down", detail: "timeout", ms: Date.now() - start };
  }
}

export async function testAllSources(): Promise<SourceHealth[]> {
  const jobs = [
    testMangaDex(),
    testAnimePlanet(),
    testComick(),
    ...COVER_SITES.map((s) => testCoverSite(s.site, s.name)),
    ...CHAPTER_SITES.map((s) => testChapterSite(s.site, s.name)),
  ];
  const settled = await Promise.allSettled(jobs);
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { name: `source #${i}`, kind: "cover" as const, status: "down" as const, ms: 0 }
  );
}
