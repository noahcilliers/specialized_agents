import { NextResponse, type NextRequest } from "next/server";
import { completeConnection } from "@/lib/plugins/google-calendar/oauth";

const STATE_COOKIE = "gcal_oauth_state";

/** Google redirects here after the user approves (or cancels) access. */
export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/plugins?gcal=${status}`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/plugins/google-calendar" });
    return res;
  };

  if (searchParams.get("error")) return back("cancelled");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return back("invalid_state");

  try {
    await completeConnection(code, origin);
    return back("connected");
  } catch (err) {
    console.error("Google Calendar connection failed:", err);
    return back("failed");
  }
}
