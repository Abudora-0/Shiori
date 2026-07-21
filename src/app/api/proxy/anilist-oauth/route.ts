import { NextRequest, NextResponse } from "next/server";

const TOKEN_URL = "https://anilist.co/api/v2/oauth/token";

/**
 * Exchanges an AniList OAuth authorization code for an access token.
 * Runs server-side so the client secret never has to travel further than
 * this machine's own Next.js server (this is a local-first, single-user
 * app — there's no multi-tenant secret-leak concern, but keeping the
 * exchange server-side is still the correct shape for this flow).
 */
export async function POST(req: NextRequest) {
  let body: {
    code?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { code, clientId, clientSecret, redirectUri } = body;
  if (!code || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json({ error: "AniList token endpoint unreachable." }, { status: 502 });
  }

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: `AniList rejected the exchange (${res.status}): ${text.slice(0, 300)}` },
      { status: 400 }
    );
  }
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
