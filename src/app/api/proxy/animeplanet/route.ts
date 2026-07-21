import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * Anime-Planet series info scraper (no API exists). Given a title, finds the
 * best-matching series page and extracts Anime-Planet-specific data: their
 * community rating, tags and content warnings. Best-effort — markup changes
 * or Cloudflare may break it.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface ApInfo {
  url: string;
  name: string;
  cover?: string;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  contentWarnings: string[];
  rank?: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  const type = req.nextUrl.searchParams.get("type") === "anime" ? "anime" : "manga";
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const searchHtml = await get(
    `https://www.anime-planet.com/${type}/all?name=${encodeURIComponent(title)}`
  );
  if (!searchHtml) {
    return NextResponse.json(
      { error: "Anime-Planet unreachable (possibly blocking automated access)." },
      { status: 502 }
    );
  }

  const $s = cheerio.load(searchHtml);
  const want = normalize(title);

  // Result cards; prefer exact name match, else first card
  let href: string | undefined;
  let name: string | undefined;
  $s(`ul.cardDeck li.card a[href^='/${type}/']`).each((_, el) => {
    const cardName = $s(el).find("h3.cardName").text().trim() || $s(el).attr("title") || "";
    if (!href) {
      href = $s(el).attr("href");
      name = cardName;
    }
    if (normalize(cardName) === want) {
      href = $s(el).attr("href");
      name = cardName;
      return false; // break
    }
  });

  // The search sometimes redirects straight to the series page
  if (!href && $s("h1[itemprop='name']").length) {
    href = "";
  }
  if (href === undefined) {
    return NextResponse.json({ error: "Not found on Anime-Planet." }, { status: 404 });
  }

  const pageUrl = `https://www.anime-planet.com${href}`;
  const html = href === "" ? searchHtml : await get(pageUrl);
  if (!html) {
    return NextResponse.json({ error: "Series page unreachable." }, { status: 502 });
  }

  const $ = cheerio.load(html);
  const info: ApInfo = {
    url: pageUrl,
    name: $("h1[itemprop='name']").first().text().trim() || name || title,
    tags: [],
    contentWarnings: [],
  };

  let cover =
    $("img[itemprop='image']").first().attr("src") ||
    $(".mainEntry img").first().attr("src");
  if (cover?.startsWith("//")) cover = `https:${cover}`;
  if (cover?.startsWith("/")) cover = `https://www.anime-planet.com${cover}`;
  if (cover) info.cover = cover;

  const ratingVal = Number($("meta[itemprop='ratingValue']").attr("content"));
  if (Number.isFinite(ratingVal) && ratingVal > 0) info.rating = ratingVal;
  const ratingCount = Number($("meta[itemprop='ratingCount']").attr("content"));
  if (Number.isFinite(ratingCount) && ratingCount > 0) info.ratingCount = ratingCount;

  const rankText = $(".pure-1 .iconRank, div:contains('Rank #')")
    .filter((_, el) => /Rank\s*#/.test($(el).text()))
    .first()
    .text();
  const rank = Number(/Rank\s*#([\d,]+)/.exec(rankText)?.[1]?.replace(/,/g, ""));
  if (Number.isFinite(rank) && rank > 0) info.rank = rank;

  // Tags + content warnings live in .tags blocks; warnings under a heading
  $("div.tags").each((_, block) => {
    const heading = $(block).find("h4").text().toLowerCase();
    const items = $(block)
      .find("li a")
      .map((_, a) => $(a).text().trim())
      .get()
      .filter(Boolean);
    if (heading.includes("content warning")) info.contentWarnings.push(...items);
    else info.tags.push(...items);
  });
  info.tags = [...new Set(info.tags)].slice(0, 20);
  info.contentWarnings = [...new Set(info.contentWarnings)];

  return NextResponse.json(info);
}
