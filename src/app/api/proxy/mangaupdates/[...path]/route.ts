import { NextRequest, NextResponse } from "next/server";

const MU_API = "https://api.mangaupdates.com/v1";

async function forward(req: NextRequest, path: string[], body?: string) {
  const url = `${MU_API}/${path.map(encodeURIComponent).join("/")}?${req.nextUrl.searchParams}`;
  try {
    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "MangaUpdates unreachable." }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return forward(req, path, await req.text());
}
