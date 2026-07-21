import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * HentaiEra gallery info scraper — same IMHentai-family markup as HentaiFox,
 * so the parsing mirrors that route. Best-effort.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  const res = await fetch(`https://hentaiera.com/gallery/${id}/`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) {
    return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `HentaiEra returned ${res.status} — it may be blocking access.` },
      { status: 502 }
    );
  }

  const $ = cheerio.load(await res.text());
  const title = $(".info h1").first().text().trim() || $("h1").first().text().trim();
  if (!title) {
    return NextResponse.json(
      { error: "Couldn't parse the gallery page (markup changed?)." },
      { status: 502 }
    );
  }

  const byPrefix = (prefix: string) =>
    $(`.info a[href^='/${prefix}/'], a[href*='hentaiera.com/${prefix}/']`)
      .map((_, a) => $(a).text().replace(/\s*\d[\d,]*\s*$/, "").trim())
      .get()
      .filter(Boolean);

  const pagesText = $(".info span:contains('Pages'), li:contains('Pages')").first().text();
  const pages = Number(/(\d+)/.exec(pagesText)?.[1]);

  let cover =
    $(".cover img").first().attr("data-src") || $(".cover img").first().attr("src");
  if (cover && cover.startsWith("//")) cover = `https:${cover}`;

  return NextResponse.json({
    id,
    title,
    url: `https://hentaiera.com/gallery/${id}/`,
    cover,
    tags: byPrefix("tag"),
    artists: byPrefix("artist"),
    parodies: byPrefix("parody"),
    characters: byPrefix("character"),
    groups: byPrefix("group"),
    language: byPrefix("language").find((l) => l.toLowerCase() !== "translated"),
    pages: Number.isFinite(pages) ? pages : undefined,
  });
}
