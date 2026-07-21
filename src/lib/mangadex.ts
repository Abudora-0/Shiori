import type { Series } from "./types";
import { displayTitle } from "./format";

/**
 * MangaDex public API (CORS-enabled) — chapter lists for manga series pages.
 * We find the MangaDex entry by title search and verify it via the `links.al`
 * (AniList) / `links.mal` attributes so we don't show the wrong series.
 */

const API = "https://api.mangadex.org";

export interface MdChapter {
  id: string;
  chapter?: string;
  volume?: string;
  title?: string;
  group?: string;
  pages?: number;
  publishAt?: string;
  externalUrl?: string;
}

export interface MdResult {
  mangaId: string;
  verified: boolean;
  totalChapters: number;
  chapters: MdChapter[];
}

interface MdManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    links?: { al?: string; mal?: string };
  };
}

async function findMangaId(series: Series): Promise<{ id: string; verified: boolean } | null> {
  const titles = [
    displayTitle(series.title),
    series.title.romaji,
    series.title.english,
  ].filter((t, i, a): t is string => !!t && a.indexOf(t) === i);

  for (const title of titles.slice(0, 2)) {
    const res = await fetch(
      `${API}/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { data: MdManga[] };
    // Prefer an entry whose AniList/MAL link matches ours
    for (const m of json.data) {
      const al = Number(m.attributes.links?.al);
      const mal = Number(m.attributes.links?.mal);
      if (
        (series.id > 0 && al === series.id) ||
        (series.idMal && mal === series.idMal)
      ) {
        return { id: m.id, verified: true };
      }
    }
  }
  return null;
}

export async function fetchMangaDexChapters(series: Series): Promise<MdResult | null> {
  const found = await findMangaId(series);
  if (!found) return null;

  const chapters: MdChapter[] = [];
  let total = 0;
  for (let offset = 0; offset < 400; offset += 100) {
    const res = await fetch(
      `${API}/manga/${found.id}/feed?limit=100&offset=${offset}` +
        `&translatedLanguage[]=en&order[chapter]=desc` +
        `&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
    );
    if (!res.ok) break;
    const json = (await res.json()) as {
      data: {
        id: string;
        attributes: {
          chapter?: string;
          volume?: string;
          title?: string;
          pages?: number;
          publishAt?: string;
          externalUrl?: string;
        };
        relationships: { type: string; attributes?: { name?: string } }[];
      }[];
      total: number;
    };
    total = json.total;
    for (const c of json.data) {
      chapters.push({
        id: c.id,
        chapter: c.attributes.chapter ?? undefined,
        volume: c.attributes.volume ?? undefined,
        title: c.attributes.title ?? undefined,
        pages: c.attributes.pages,
        publishAt: c.attributes.publishAt,
        externalUrl: c.attributes.externalUrl ?? undefined,
        group: c.relationships.find((r) => r.type === "scanlation_group")
          ?.attributes?.name,
      });
    }
    if (offset + 100 >= json.total) break;
  }

  // De-dupe by chapter number (keep first = newest listing per number)
  const seen = new Set<string>();
  const unique = chapters.filter((c) => {
    const key = c.chapter ?? c.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    mangaId: found.id,
    verified: found.verified,
    totalChapters: total,
    chapters: unique,
  };
}
