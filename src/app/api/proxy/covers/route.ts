import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * Cover hunter for scanlation aggregators without APIs. Each site config
 * declares a search URL and selectors; we grab result items, verify the name
 * loosely matches, and return the image URL. All best-effort — these sites
 * change markup and sit behind Cloudflare.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface SiteConfig {
  search: (q: string) => string;
  /** selector for one result item (contains both name and img) */
  item: string;
  name: (item: cheerio.Cheerio<never>, $: cheerio.CheerioAPI) => string;
  img: (item: cheerio.Cheerio<never>, $: cheerio.CheerioAPI) => string | undefined;
  base: string;
}

function attrImg(el: cheerio.Cheerio<never>, sel: string): string | undefined {
  const img = el.find(sel).first();
  return (
    img.attr("data-src") ||
    img.attr("data-lazy-src") ||
    img.attr("data-original") ||
    img.attr("src") ||
    undefined
  );
}

/** Madara (WordPress) theme sites all share the same search markup. */
function madara(base: string): SiteConfig {
  return {
    base,
    search: (q) => `${base}/?s=${encodeURIComponent(q)}&post_type=wp-manga`,
    item: ".c-tabs-item__content, .c-tabs-item .row",
    name: (el) => el.find(".post-title a").first().text().trim(),
    img: (el) => attrImg(el, ".tab-thumb img, img"),
  };
}

/** MangaBuddy-family sites (kaliscan.io, mangak.io, manhwabuddy.com …). */
function buddy(base: string): SiteConfig {
  return {
    base,
    search: (q) => `${base}/search?q=${encodeURIComponent(q)}`,
    item: ".book-item, .book-detailed-item, .manga-item, article",
    name: (el) =>
      el.find(".title a, .title h3 a, h3 a, .book-name, h2").first().text().trim() ||
      el.find("a").first().attr("title")?.trim() ||
      el.find("img").first().attr("alt")?.trim() ||
      "",
    img: (el) => attrImg(el, ".thumb img, img"),
  };
}

const SITES: Record<string, SiteConfig> = {
  madaradex: madara("https://madaradex.org"),
  kingofshojo: madara("https://kingofshojo.com"),
  manhwabuddy: buddy("https://manhwabuddy.com"),
  mangak: buddy("https://mangak.io"),
  kaliscan: buddy("https://kaliscan.io"),
  mangafox: {
    base: "https://fanfox.net",
    search: (q) => `https://fanfox.net/search?title=${encodeURIComponent(q)}`,
    item: ".manga-list-4-list > li, .manga-list-1-list > li",
    name: (el) =>
      el.find(".manga-list-4-item-title a, .manga-list-1-item-title a, p a")
        .first()
        .text()
        .trim(),
    img: (el) => attrImg(el, "img"),
  },
  mangakatana: {
    base: "https://mangakatana.com",
    search: (q) =>
      `https://mangakatana.com/?search=${encodeURIComponent(q)}&search_by=book_name`,
    item: "#book_list .item, .single_book",
    name: (el) =>
      el.find("h3.title a").first().text().trim() ||
      el.find(".heading").first().text().trim(),
    img: (el) => attrImg(el, ".wrap_img img, .cover img, img"),
  },
  mangafire: {
    base: "https://mangafire.to",
    search: (q) => `https://mangafire.to/filter?keyword=${encodeURIComponent(q)}`,
    item: ".original .unit, .unit",
    name: (el) => el.find(".info a").first().text().trim() || el.find("a").last().text().trim(),
    img: (el) => attrImg(el, ".poster img, img"),
  },
  weebcentral: {
    base: "https://weebcentral.com",
    search: (q) => `https://weebcentral.com/search?text=${encodeURIComponent(q)}&sort=Best+Match&order=Descending&display_mode=Full+Display`,
    item: "article, a[href*='/series/']",
    name: (el) =>
      el.find(".text-lg, h2, .font-semibold").first().text().trim() || el.text().trim(),
    img: (el) => attrImg(el, "img"),
  },
  kagane: {
    base: "https://kagane.org",
    search: (q) => `https://kagane.org/search?q=${encodeURIComponent(q)}`,
    item: "a[href*='/series/'], .grid a, article",
    name: (el) => el.find("h3, .title, .font-semibold").first().text().trim() || el.text().trim(),
    img: (el) => attrImg(el, "img"),
  },
};

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

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  const title = req.nextUrl.searchParams.get("title");
  const config = SITES[site];
  if (!config || !title) {
    return NextResponse.json({ error: "Unknown site or missing title" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(config.search(title), {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        Referer: config.base + "/",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `${site} returned ${res.status}` }, { status: 502 });
    }
    html = await res.text();
  } catch {
    return NextResponse.json({ error: `${site} unreachable` }, { status: 502 });
  }

  const $ = cheerio.load(html);
  for (const el of $(config.item).toArray().slice(0, 12)) {
    const item = $(el) as cheerio.Cheerio<never>;
    const name = config.name(item, $);
    if (!name || !titlesMatch(name, title)) continue;
    let cover = config.img(item, $);
    if (!cover) continue;
    if (cover.startsWith("//")) cover = `https:${cover}`;
    else if (cover.startsWith("/")) cover = `${config.base}${cover}`;
    return NextResponse.json({ site, name, cover });
  }
  return NextResponse.json({ error: "No match" }, { status: 404 });
}
