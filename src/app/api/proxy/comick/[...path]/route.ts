import { NextRequest, NextResponse } from "next/server";

const COMICK_API = "https://api.comick.fun";

/** Proxy for the Comick API - it sits behind Cloudflare and rejects browser CORS. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const url = `${COMICK_API}/${path.map(encodeURIComponent).join("/")}?${req.nextUrl.searchParams}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Comick unreachable." }, { status: 502 });
  }
}
