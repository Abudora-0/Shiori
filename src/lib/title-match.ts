import { gql, MEDIA_FIELDS, mapMediaToSeries, type RawMedia } from "./anilist";
import type { Series } from "./types";

/**
 * Batched title → AniList matching using GraphQL aliases (8 searches per
 * request keeps well under AniList's complexity cap while multiplying the
 * effective rate limit).
 */

export interface TitleQuery {
  key: string;
  title: string;
  type?: "ANIME" | "MANGA";
  year?: number;
}

const BATCH = 8;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function pickBest(q: TitleQuery, candidates: RawMedia[]): RawMedia | undefined {
  if (!candidates.length) return undefined;
  const want = normalize(q.title);
  const scored = candidates.map((c) => {
    const titles = [c.title.romaji, c.title.english, c.title.native]
      .filter(Boolean)
      .map((t) => normalize(t!));
    let score = 0;
    if (titles.includes(want)) score += 100;
    else if (titles.some((t) => t.startsWith(want) || want.startsWith(t))) score += 40;
    else if (titles.some((t) => t.includes(want) || want.includes(t))) score += 20;
    if (q.year && (c.seasonYear === q.year || c.startDate?.year === q.year)) score += 15;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // Require at least a partial title overlap — otherwise better no match than wrong match
  return scored[0].score >= 20 ? scored[0].c : undefined;
}

export async function matchTitles(
  queries: TitleQuery[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, Series>> {
  const out = new Map<string, Series>();

  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH);
    const varDefs = batch
      .map((_, j) => `$q${j}: String, $t${j}: MediaType`)
      .join(", ");
    const aliases = batch
      .map(
        (_, j) => `
      m${j}: Page(perPage: 4) {
        media(search: $q${j}, type: $t${j}, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }`
      )
      .join("\n");
    const query = `query (${varDefs}) { ${aliases} }`;

    const variables: Record<string, unknown> = {};
    batch.forEach((q, j) => {
      variables[`q${j}`] = q.title;
      variables[`t${j}`] = q.type ?? null;
    });

    const data = await gql<Record<string, { media: RawMedia[] }>>(query, variables);
    batch.forEach((q, j) => {
      const best = pickBest(q, data[`m${j}`]?.media ?? []);
      if (best) out.set(q.key, mapMediaToSeries(best));
    });
    onProgress?.(Math.min(i + BATCH, queries.length), queries.length);
  }
  return out;
}
