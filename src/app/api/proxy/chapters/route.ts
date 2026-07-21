import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * Chapter list scraper for MangaKatana / KaliScan / WeebCentral / Kagane.
 * Flow per site: search the title → best-matching series page → parse its
 * chapter list. The client queries all sites and keeps the fullest result.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface ScrapedChapter {
  label: string;
  number?: number;
  date?: string;
  url?: string;
}

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
  return na === nb || na.includes(nb) || nb.includes(na);
}

function chapterNumber(label: string): number | undefined {
  const m =
    /(?:chapter|chap|ch\.?|episode|ep\.?)\s*#?\s*([\d]+(?:\.\d+)?)/i.exec(label) ??
    /([\d]+(?:\.\d+)?)/.exec(label);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

async function fetchHtml(url: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        Referer: referer,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function absolute(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${base}${href}`;
  return href;
}

/* ————— MangaKatana ————— */

async function mangakatana(title: string) {
  const base = "https://mangakatana.com";
  const searchHtml = await fetchHtml(
    `${base}/?search=${encodeURIComponent(title)}&search_by=book_name`,
    base
  );
  if (!searchHtml) return null;
  let $ = cheerio.load(searchHtml);

  // Single hits render the series page directly
  let name = $(".info h1.heading").first().text().trim();
  if (!$(".chapters table").length) {
    let seriesUrl: string | undefined;
    $("#book_list .item").each((_, el) => {
      const a = $(el).find("h3.title a").first();
      if (!seriesUrl && titlesMatch(a.text().trim(), title)) {
        seriesUrl = absolute(a.attr("href"), base);
        name = a.text().trim();
      }
    });
    if (!seriesUrl) return null;
    const pageHtml = await fetchHtml(seriesUrl, base);
    if (!pageHtml) return null;
    $ = cheerio.load(pageHtml);
    name = $(".info h1.heading").first().text().trim() || name;
  }

  const chapters: ScrapedChapter[] = [];
  $(".chapters table tr").each((_, el) => {
    const a = $(el).find(".chapter a").first();
    const label = a.text().trim();
    if (!label) return;
    chapters.push({
      label,
      number: chapterNumber(label),
      date: $(el).find(".update_time").first().text().trim() || undefined,
      url: absolute(a.attr("href"), base),
    });
  });
  return chapters.length ? { name: name || title, chapters } : null;
}

/* ————— MangaBuddy family (KaliScan, Kagane fallback shape) ————— */

async function buddySite(base: string, title: string) {
  const searchHtml = await fetchHtml(
    `${base}/search?q=${encodeURIComponent(title)}`,
    base
  );
  if (!searchHtml) return null;
  const $s = cheerio.load(searchHtml);

  let seriesUrl: string | undefined;
  let name = "";
  $s(".book-item, .book-detailed-item").each((_, el) => {
    const a = $s(el).find(".title a, .title h3 a, h3 a").first();
    const candidate =
      a.text().trim() || $s(el).find("img").first().attr("alt")?.trim() || "";
    if (!seriesUrl && candidate && titlesMatch(candidate, title)) {
      seriesUrl = absolute(a.attr("href") ?? $s(el).find("a").first().attr("href"), base);
      name = candidate;
    }
  });
  if (!seriesUrl) return null;

  const pageHtml = await fetchHtml(seriesUrl, base);
  if (!pageHtml) return null;
  const $ = cheerio.load(pageHtml);

  const chapters: ScrapedChapter[] = [];
  $("#chapter-list li, ul.chapter-list li").each((_, el) => {
    const a = $(el).find("a").first();
    const label =
      $(el).find(".chapter-title").first().text().trim() ||
      a.attr("title")?.trim() ||
      a.text().trim();
    if (!label) return;
    chapters.push({
      label,
      number: chapterNumber(label),
      date:
        $(el).find(".chapter-update").first().attr("datetime") ||
        $(el).find(".chapter-update, time").first().text().trim() ||
        undefined,
      url: absolute(a.attr("href"), base),
    });
  });
  return chapters.length ? { name, chapters } : null;
}

/* ————— WeebCentral ————— */

async function weebcentral(title: string) {
  const base = "https://weebcentral.com";
  const searchHtml = await fetchHtml(
    `${base}/search?text=${encodeURIComponent(title)}&sort=Best+Match&order=Descending&display_mode=Full+Display`,
    base
  );
  if (!searchHtml) return null;
  const $s = cheerio.load(searchHtml);

  let seriesUrl: string | undefined;
  let name = "";
  $s("a[href*='/series/']").each((_, el) => {
    const text = $s(el).find(".text-lg, h2, .font-semibold").first().text().trim() ||
      $s(el).text().trim();
    if (!seriesUrl && text && titlesMatch(text, title)) {
      seriesUrl = absolute($s(el).attr("href"), base);
      name = text;
    }
  });
  if (!seriesUrl) return null;

  const idMatch = /\/series\/([^/]+)/.exec(seriesUrl);
  if (!idMatch) return null;
  const listHtml = await fetchHtml(
    `${base}/series/${idMatch[1]}/full-chapter-list`,
    seriesUrl
  );
  if (!listHtml) return null;
  const $ = cheerio.load(listHtml);

  const chapters: ScrapedChapter[] = [];
  $("a[href*='/chapters/']").each((_, el) => {
    const label = $(el).find("span").filter((_, s) => /\d/.test($(s).text()))
      .first()
      .text()
      .trim() || $(el).text().trim();
    if (!label) return;
    chapters.push({
      label,
      number: chapterNumber(label),
      date: $(el).find("time").first().attr("datetime") || undefined,
      url: absolute($(el).attr("href"), base),
    });
  });
  return chapters.length ? { name, chapters } : null;
}

/* ————— Kagane ————— */

async function kagane(title: string) {
  const base = "https://kagane.org";
  // Try MangaBuddy-shaped markup first, then a generic sweep
  const buddy = await buddySite(base, title);
  if (buddy) return buddy;

  const searchHtml = await fetchHtml(
    `${base}/search?q=${encodeURIComponent(title)}`,
    base
  );
  if (!searchHtml) return null;
  const $s = cheerio.load(searchHtml);
  let seriesUrl: string | undefined;
  let name = "";
  $s("a[href*='/series/']").each((_, el) => {
    const text =
      $s(el).find("h3, .title").first().text().trim() ||
      $s(el).attr("title")?.trim() ||
      $s(el).find("img").first().attr("alt")?.trim() ||
      "";
    if (!seriesUrl && text && titlesMatch(text, title)) {
      seriesUrl = absolute($s(el).attr("href"), base);
      name = text;
    }
  });
  if (!seriesUrl) return null;
  const pageHtml = await fetchHtml(seriesUrl, base);
  if (!pageHtml) return null;
  const $ = cheerio.load(pageHtml);
  const chapters: ScrapedChapter[] = [];
  $("a[href*='chapter']").each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, " ");
    if (!label || !/\d/.test(label)) return;
    chapters.push({
      label: label.slice(0, 80),
      number: chapterNumber(label),
      url: absolute($(el).attr("href"), base),
    });
  });
  return chapters.length ? { name, chapters } : null;
}

/* ————— Route ————— */

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  const title = req.nextUrl.searchParams.get("title");
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  let result: { name: string; chapters: ScrapedChapter[] } | null = null;
  try {
    switch (site) {
      case "mangakatana":
        result = await mangakatana(title);
        break;
      case "kaliscan":
        result = await buddySite("https://kaliscan.io", title);
        break;
      case "weebcentral":
        result = await weebcentral(title);
        break;
      case "kagane":
        result = await kagane(title);
        break;
      default:
        return NextResponse.json({ error: "Unknown site" }, { status: 400 });
    }
  } catch {
    result = null;
  }
  if (!result) return NextResponse.json({ error: "No match" }, { status: 404 });

  // De-dupe by chapter number, newest first
  const seen = new Set<string>();
  const chapters = result.chapters
    .filter((c) => {
      const key = c.number != null ? String(c.number) : c.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0));

  return NextResponse.json({ site, name: result.name, chapters });
}
