import type { Series } from "./types";
import { displayTitle } from "./format";

/**
 * Chapter data comes from scanlation sites scraped server-side:
 * MangaKatana, KaliScan, WeebCentral and Kagane are queried in parallel and
 * the site returning the most chapters wins ("most consistency").
 * MangaUpdates release lists remain as a last-resort fallback.
 * (MangaDex/Comick were dropped by user request - Comick is region-blocked.)
 */

export interface ChapterInfo {
  id: string;
  number?: number;
  label: string;
  volume?: string;
  title?: string;
  group?: string;
  date?: string;
  url?: string;
}

export interface ChapterResult {
  provider: string;
  verified: boolean;
  chapters: ChapterInfo[];
}

const SCRAPE_SITES = [
  { site: "mangakatana", label: "MangaKatana" },
  { site: "kaliscan", label: "KaliScan" },
  { site: "weebcentral", label: "WeebCentral" },
  { site: "kagane", label: "Kagane" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface ScrapeResponse {
  site: string;
  name: string;
  chapters: { label: string; number?: number; date?: string; url?: string }[];
}

async function fromScrapeSite(
  site: string,
  title: string
): Promise<ScrapeResponse | null> {
  const res = await fetch(
    `/api/proxy/chapters?site=${site}&title=${encodeURIComponent(title)}`
  );
  if (!res.ok) return null;
  return (await res.json()) as ScrapeResponse;
}

export async function fetchChapters(series: Series): Promise<ChapterResult | null> {
  const title = displayTitle(series.title);

  const settled = await Promise.allSettled(
    SCRAPE_SITES.map((s) => fromScrapeSite(s.site, title))
  );

  let best: { label: string; data: ScrapeResponse } | null = null;
  settled.forEach((outcome, i) => {
    if (outcome.status !== "fulfilled" || !outcome.value?.chapters.length) return;
    if (!best || outcome.value.chapters.length > best.data.chapters.length) {
      best = { label: SCRAPE_SITES[i].label, data: outcome.value };
    }
  });

  if (best) {
    const { label, data } = best as { label: string; data: ScrapeResponse };
    const wanted = [series.title.romaji, series.title.english, series.title.native]
      .filter(Boolean)
      .map((t) => normalize(t!));
    return {
      provider: label,
      verified: wanted.includes(normalize(data.name)),
      chapters: data.chapters.map((c, i) => ({
        id: c.url ?? `${data.site}-${i}`,
        number: c.number,
        label: c.label,
        date: c.date,
        url: c.url,
      })),
    };
  }

  // Fallback: MangaUpdates release lists
  try {
    return await fromMangaUpdates(series);
  } catch {
    return null;
  }
}

/* ----- MangaUpdates (release lists, fallback) ----- */

async function fromMangaUpdates(series: Series): Promise<ChapterResult | null> {
  const title = displayTitle(series.title);
  const searchRes = await fetch(`/api/proxy/mangaupdates/series/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search: title, perpage: 5 }),
  });
  if (!searchRes.ok) return null;
  const search = (await searchRes.json()) as {
    results?: { record: { series_id: number; title: string } }[];
  };
  const wanted = [series.title.romaji, series.title.english, series.title.native]
    .filter(Boolean)
    .map((t) => normalize(t!));
  const match = search.results?.find((r) =>
    wanted.includes(normalize(r.record.title))
  );
  if (!match) return null;

  const chapters: ChapterInfo[] = [];
  for (let page = 1; page <= 3; page++) {
    const relRes = await fetch(`/api/proxy/mangaupdates/releases/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search: String(match.record.series_id),
        search_type: "series",
        perpage: 100,
        page,
      }),
    });
    if (!relRes.ok) break;
    const json = (await relRes.json()) as {
      results?: {
        record: {
          id: number;
          chapter?: string;
          volume?: string;
          groups?: { name: string }[];
          release_date?: string;
        };
      }[];
    };
    const batch = json.results ?? [];
    for (const r of batch) {
      const last = r.record.chapter?.split("-").pop()?.trim();
      const num = last ? Number(last) : undefined;
      chapters.push({
        id: String(r.record.id),
        number: Number.isFinite(num) ? num : undefined,
        label: r.record.chapter ? `Ch. ${r.record.chapter}` : "Release",
        volume: r.record.volume,
        group: r.record.groups?.map((g) => g.name).join(", "),
        date: r.record.release_date,
      });
    }
    if (batch.length < 100) break;
  }
  if (!chapters.length) return null;

  chapters.sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  const seen = new Set<string>();
  const unique = chapters.filter((c) => {
    const key = c.number != null ? String(c.number) : c.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { provider: "MangaUpdates", verified: false, chapters: unique };
}
