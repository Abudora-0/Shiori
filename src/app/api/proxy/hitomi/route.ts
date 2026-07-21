import { NextRequest, NextResponse } from "next/server";

/**
 * Hitomi gallery info — their per-gallery metadata lives in a JS file
 * (`var galleryinfo = {...}`). Hitomi has moved CDN domains before, so we
 * try both known hosts. Covers are skipped: hitomi thumbnail URLs require
 * their rotating hash scheme.
 */

const HOSTS = ["https://ltn.gold-usergeneratedcontent.net", "https://ltn.hitomi.la"];

interface HitomiTag {
  tag: string;
  female?: string | number;
  male?: string | number;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  let text: string | null = null;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/galleries/${id}.js`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Referer: "https://hitomi.la/",
        },
        cache: "no-store",
      });
      if (res.ok) {
        text = await res.text();
        break;
      }
    } catch {
      // try next host
    }
  }
  if (!text) {
    return NextResponse.json(
      { error: "Hitomi gallery info unreachable." },
      { status: 502 }
    );
  }

  const eq = text.indexOf("=");
  if (eq === -1) {
    return NextResponse.json({ error: "Unexpected galleryinfo format." }, { status: 502 });
  }

  let info: {
    title?: string;
    japanese_title?: string | null;
    language_localname?: string | null;
    language?: string | null;
    type?: string;
    tags?: HitomiTag[] | null;
    artists?: { artist: string }[] | null;
    groups?: { group: string }[] | null;
    parodys?: { parody: string }[] | null;
    characters?: { character: string }[] | null;
    files?: unknown[];
  };
  try {
    // The response is a JS statement (`var galleryinfo = {...};`), not bare
    // JSON — strip the trailing semicolon or JSON.parse throws on every call.
    info = JSON.parse(text.slice(eq + 1).trim().replace(/;\s*$/, ""));
  } catch {
    return NextResponse.json({ error: "Couldn't parse galleryinfo." }, { status: 502 });
  }

  return NextResponse.json({
    id,
    title: info.title ?? `Hitomi #${id}`,
    titleNative: info.japanese_title ?? undefined,
    url: `https://hitomi.la/galleries/${id}.html`,
    tags: (info.tags ?? []).map((t) =>
      t.female ? `${t.tag} ♀` : t.male ? `${t.tag} ♂` : t.tag
    ),
    artists: (info.artists ?? []).map((a) => a.artist),
    groups: (info.groups ?? []).map((g) => g.group),
    parodies: (info.parodys ?? []).map((p) => p.parody),
    characters: (info.characters ?? []).map((c) => c.character),
    language: info.language ?? undefined,
    pages: info.files?.length || undefined,
  });
}
