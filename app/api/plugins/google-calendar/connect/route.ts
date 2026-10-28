import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, isConfigured } from "@/lib/plugins/google-calendar/oauth";

const STATE_COOKIE = "gcal_oauth_state";

/** Send the user to Google's consent screen. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!isConfigured()) {
    return NextResponse.redirect(new URL("/plugins?gcal=not_configured", origin));
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/api/plugins/google-calendar",
    maxAge: 600,
  });
  return res;
}
