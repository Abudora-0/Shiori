import { NextRequest, NextResponse } from "next/server";

const NH = "https://nhentai.net";

/**
 * nhentai proxy. The site sits behind Cloudflare; the user's own browser
 * cookies (sessionid + cf_clearance, pasted in the Annex) are forwarded so
 * favorites pages resolve. Best-effort — Cloudflare may still challenge.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const qs = req.nextUrl.searchParams.toString();
  const url = `${NH}/${path.map(encodeURIComponent).join("/")}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/json",
    Referer: `${NH}/`,
  };
  const cookie = req.headers.get("x-nh-cookie");
  if (cookie) headers.Cookie = cookie;

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "text/html",
      },
    });
  } catch {
    return NextResponse.json({ error: "nhentai unreachable." }, { status: 502 });
  }
}
