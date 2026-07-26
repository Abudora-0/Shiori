import { db, logActivity } from "./db";
import type { DoujinEntry, DoujinSource } from "./types";

/**
 * Doujin importers for the Annex. All network calls go through our proxy
 * routes; HTML is parsed client-side with DOMParser.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Insert or refresh by (source, sourceId); user data (rating/notes/favorite) survives. */
export async function upsertDoujin(
  incoming: Omit<DoujinEntry, "id" | "addedAt" | "favorite">
): Promise<"added" | "updated"> {
  const existing = await db.doujins
    .where("sourceId")
    .equals(incoming.sourceId)
    .and((d) => d.source === incoming.source)
    .first();
  if (existing) {
    await db.doujins.update(existing.id!, {
      ...incoming,
      rating: existing.rating,
      notes: existing.notes,
      favorite: existing.favorite,
      updatedAt: Date.now(),
    });
    return "updated";
  }
  await db.doujins.add({
    ...incoming,
    favorite: false,
    addedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await logActivity();
  return "added";
}

/* ----- nhentai ----- */

interface NhGallery {
  id: number;
  media_id: string;
  title: { english?: string; japanese?: string; pretty?: string };
  images?: { thumbnail?: { t?: string }; cover?: { t?: string } };
  tags: { type: string; name: string }[];
  num_pages?: number;
}

const NH_EXT: Record<string, string> = { j: "jpg", p: "png", g: "gif", w: "webp" };

function nhCookieHeaders(cookie?: string): HeadersInit {
  return cookie ? { "x-nh-cookie": cookie } : {};
}

export async function fetchNhentaiGallery(
  id: string,
  cookie?: string
): Promise<Omit<DoujinEntry, "id" | "addedAt" | "favorite">> {
  const res = await fetch(`/api/proxy/nhentai/api/gallery/${id}`, {
    headers: nhCookieHeaders(cookie),
  });
  if (res.status === 404) throw new Error(`nhentai gallery #${id} not found.`);
  if (!res.ok)
    throw new Error(
      `nhentai returned ${res.status} - Cloudflare may be blocking; paste fresh cookies in the Annex.`
    );
  const g = (await res.json()) as NhGallery;
  const byType = (type: string) =>
    g.tags.filter((t) => t.type === type).map((t) => t.name);
  const thumbExt = NH_EXT[g.images?.thumbnail?.t ?? "j"] ?? "jpg";
  return {
    source: "nhentai",
    sourceId: String(g.id),
    title: g.title.pretty || g.title.english || g.title.japanese || `#${g.id}`,
    titleNative: g.title.japanese ?? undefined,
    url: `https://nhentai.net/g/${g.id}/`,
    cover: `https://t.nhentai.net/galleries/${g.media_id}/thumb.${thumbExt}`,
    tags: byType("tag"),
    artists: byType("artist"),
    groups: byType("group"),
    parodies: byType("parody"),
    characters: byType("character"),
    language: byType("language").find((l) => l !== "translated"),
    pages: g.num_pages,
  };
}

export interface DoujinImportProgress {
  phase: "listing" | "details";
  count: number;
  total?: number;
}

export interface DoujinImportResult {
  added: number;
  updated: number;
  failed: number;
}

/** Scrape the logged-in favorites pages, then pull full metadata per gallery. */
export async function importNhentaiFavorites(
  cookie: string,
  onProgress?: (p: DoujinImportProgress) => void
): Promise<DoujinImportResult> {
  const ids: string[] = [];
  const parser = new DOMParser();

  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`/api/proxy/nhentai/favorites?page=${page}`, {
      headers: nhCookieHeaders(cookie),
    });
    if (!res.ok)
      throw new Error(
        `Favorites page returned ${res.status} - check that your cookies are fresh (sessionid + cf_clearance).`
      );
    const doc = parser.parseFromString(await res.text(), "text/html");

    if (page === 1 && doc.querySelector("form[action*='login'], input[name='password']")) {
      throw new Error("nhentai served the login page - your sessionid cookie is missing or expired.");
    }

    const links = [...doc.querySelectorAll(".gallery a.cover")]
      .map((a) => /\/g\/(\d+)/.exec(a.getAttribute("href") ?? "")?.[1])
      .filter((x): x is string => !!x);
    if (links.length === 0) break;
    ids.push(...links);
    onProgress?.({ phase: "listing", count: ids.length });
    await sleep(400);
  }
  if (ids.length === 0)
    throw new Error("No favorites found - empty list, or nhentai blocked the request.");

  const result: DoujinImportResult = { added: 0, updated: 0, failed: 0 };
  for (let i = 0; i < ids.length; i++) {
    try {
      const meta = await fetchNhentaiGallery(ids[i], cookie);
      const outcome = await upsertDoujin(meta);
      result[outcome]++;
    } catch {
      result.failed++;
    }
    onProgress?.({ phase: "details", count: i + 1, total: ids.length });
    await sleep(350);
  }
  return result;
}

/* ----- Add by URL (nhentai / hentaifox / hitomi) ----- */

export function parseDoujinUrl(
  input: string
): { source: DoujinSource; id: string } | null {
  const s = input.trim();
  let m = /nhentai\.net\/g\/(\d+)/.exec(s);
  if (m) return { source: "nhentai", id: m[1] };
  if (/^\d+$/.test(s)) return { source: "nhentai", id: s }; // bare id = nhentai
  m = /hentaifox\.com\/(?:gallery|g)\/(\d+)/.exec(s);
  if (m) return { source: "hentaifox", id: m[1] };
  m = /hentaiera\.com\/(?:gallery|g)\/(\d+)/.exec(s);
  if (m) return { source: "hentaiera", id: m[1] };
  m = /hitomi\.la\/(?:galleries|manga|doujinshi|cg|gamecg|reader)\/(?:[^/]*-)?(\d+)\.html/.exec(s);
  if (m) return { source: "hitomi", id: m[1] };
  return null;
}

export async function addDoujinByUrl(
  input: string,
  nhCookie?: string
): Promise<{ outcome: "added" | "updated"; title: string }> {
  const parsed = parseDoujinUrl(input);
  if (!parsed)
    throw new Error(
      "Unrecognized link - paste an nhentai, HentaiFox, HentaiEra or Hitomi gallery URL (or a bare nhentai id)."
    );

  let meta: Omit<DoujinEntry, "id" | "addedAt" | "favorite">;
  if (parsed.source === "nhentai") {
    meta = await fetchNhentaiGallery(parsed.id, nhCookie);
  } else {
    const res = await fetch(`/api/proxy/${parsed.source}?id=${parsed.id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `${parsed.source} lookup failed.`);
    meta = {
      source: parsed.source,
      sourceId: parsed.id,
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
  return { outcome, title: meta.title };
}
