import { NextRequest, NextResponse } from "next/server";

const MAL_API = "https://api.myanimelist.net/v2";

/**
 * CORS proxy for the MyAnimeList API. The browser sends the user's Client ID
 * in the x-mal-client-id header; we forward it as X-MAL-CLIENT-ID.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const clientId = req.headers.get("x-mal-client-id");
  if (!clientId) {
    return NextResponse.json({ error: "Missing MAL Client ID" }, { status: 401 });
  }

  const url = `${MAL_API}/${path.map(encodeURIComponent).join("/")}?${req.nextUrl.searchParams}`;
  try {
    const res = await fetch(url, {
      headers: { "X-MAL-CLIENT-ID": clientId },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "MyAnimeList unreachable." }, { status: 502 });
  }
}
